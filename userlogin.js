import React, { useState, useEffect, useMemo } from 'react';

import axios from 'axios';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import {userPermissionsShape} from "../propTypes"


import { DataGrid, GridToolbarContainer } from '@mui/x-data-grid';
import { Box, LinearProgress, Typography, Grid, Button, Tooltip, TextField, Autocomplete } from '@mui/material';
import { Dialog, DialogTitle, DialogContent,Chip} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';


import FilterListIcon from '@mui/icons-material/FilterList';

// Custom components
import CustomNoRowsOverlay from '../components/table/CustomNoRowsOverlay';
import SnackbarDialog from '../components/dialogs/SnackbarDialog';
import { Radio, RadioGroup, FormControlLabel, FormControl, FormLabel } from '@mui/material';

import { GridFooterContainer, GridFooter } from '@mui/x-data-grid';


import { Switch } from '@mui/material';

const CustomToolbar = ({ 
  setFilterOpen, 
  searchQuery, 
  setSearchQuery, 
  showActiveOnly, 
  setShowActiveOnly,
  userPermissions ,
  availableEmails
}) => (
  <GridToolbarContainer sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Button 
        startIcon={<FilterListIcon />} 
        onClick={() => setFilterOpen(true)}
        variant="outlined"
        size="small"
      >
        Filters
      </Button>

      {userPermissions?.is_admin && (
        <FormControlLabel
          control={
            <Switch 
              size="small"
              color="success"
              checked={showActiveOnly} 
              onChange={(e) => setShowActiveOnly(e.target.checked)} 
            />
          }
          label={
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
              Show All Active Sessions
            </Typography>
          }
        />
      )}
    </Box> 

    {console.log("aavailale emails",availableEmails)}
    {userPermissions?.is_admin && (
      <Autocomplete
        size="small"
        options={availableEmails}
        value={searchQuery || null}
        onChange={(event, newValue) => {
          setSearchQuery(newValue || ''); 
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Select or Search Email..."
            variant="outlined"
            sx={{ width: 280, backgroundColor: 'white' }}
          />
        )}
        // Ensures the dropdown behaves like a searchable select
        autoHighlight
        clearOnEscape
      />
    )}
  </GridToolbarContainer>
);

CustomToolbar.propTypes = {
  setFilterOpen: PropTypes.func.isRequired,
  searchQuery: PropTypes.string.isRequired,
  setSearchQuery: PropTypes.func.isRequired,
  showActiveOnly: PropTypes.bool.isRequired,   
  setShowActiveOnly: PropTypes.func.isRequired,
  userPermissions: userPermissionsShape.isRequired,
  availableEmails: PropTypes.arrayOf(PropTypes.string).isRequired,
};


function UserLoginLogs({ accessToken, userPermissions }) {
  const [loginLogs, setLoginLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackBarMessage, setSnackBarMessage] = useState(null);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const today = dayjs();
  
  const defaultFilters = {
    start_date: dayjs().subtract(24, 'hour'),
    end_date: today
  };
  const [filters, setFilters] = useState(defaultFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [apiMetadata, setApiMetadata] = useState({ start_date: null, end_date: null, count: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [totalRows, setTotalRows] = useState(0);
  const [availableEmails, setAvailableEmails] = useState([]);
 
 
  const fetchAllUsers = async (role, page = 1) => {
    const pageSize = 50;
    const url = `${process.env.REACT_APP_BACKEND}/api/settings/users/${role}/?page=${page}&page_size=${pageSize}`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (response.status === 200) {
        const { results, next } = response.data; 
        const emails = results.map(u => u.email);
  
        setAvailableEmails(prev => [...new Set([...prev, ...emails])]);
  
        if (next) {
          fetchAllUsers(role, page + 1);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${role} page ${page}:`, error);
    }
};

useEffect(() => {
    setAvailableEmails([]);
    fetchAllUsers('superuser');
    fetchAllUsers('technician');
}, []);


  

  const fetchLogs = (appliedFilters = filters, page = 1, pageSize = 25) => {
    setLoading(true);
    const params = { 
        active_only: showActiveOnly,
        search: searchQuery, 
        page: page,
        page_size: pageSize

    };
    
    if (appliedFilters.start_date) params.start_date = appliedFilters.start_date.format('YYYY-MM-DD');
    if (appliedFilters.end_date) params.end_date = appliedFilters.end_date.format('YYYY-MM-DD');

    axios.get(`${process.env.REACT_APP_BACKEND}/api/user/login-activity/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: params
    })
    .then(response => {
      if (response.status === 200) {
        const paginatedContainer = response?.data;
        const payload = paginatedContainer?.results;
        setLoginLogs(payload?.results || []);

        setApiMetadata(payload?.metadata || { start_date: null, end_date: null });

        setTotalRows(paginatedContainer?.count || 0); 
      } else {
        setLoginLogs([]);
        setTotalRows(0);
      }
      setLoading(false);
    })
    .catch(() => {
      setSnackBarMessage({ severity: 'error', message: "Failed to fetch logs" });
      setShowSnackbar(true);
      setLoading(false);
    });
};

useEffect(() => {
  const delayDebounceFn = setTimeout(() => {
      fetchLogs();
  }, 500);

  return () => clearTimeout(delayDebounceFn);
}, [searchQuery,showActiveOnly]); 
const CustomFooter = ({ apiMetadata, showActiveOnly ,totalRows}) => {
  
  // Extract only the YYYY-MM-DD part from ISO strings
  const getDay = (isoString) => isoString ? isoString.split('T')[0] : null;

  const startDay = getDay(apiMetadata.start_date);
  const endDay = getDay(apiMetadata.end_date);

  // Helper to format YYYY-MM-DD to DD/MM/YYYY
  const prettyDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const renderLabel = () => {
    if (!startDay || !endDay) return "No Logs Found";
    
    if (startDay === endDay) {
      // Specific styling/label for a single day
      return (
        <>
          <span>Viewing Activity for:</span> {prettyDate(startDay)}
        </>
      );
    }
    
    // Default range label
    return (
      <>
        <span>Log Range:</span> {prettyDate(startDay)} — {prettyDate(endDay)}
      </>
    );
  };

  return (
    <GridFooterContainer sx={{ px: 2, justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          {showActiveOnly ? (
            <Box component="span">
               Showing {totalRows || 0} Active Sessions
            </Box>
          ) : (
            renderLabel()
          )}
        </Typography>
      </Box>
      <GridFooter sx={{ border: 'none' }} />
    </GridFooterContainer>
  );
};
CustomFooter.propTypes = {
  apiMetadata: PropTypes.shape({
    start_date: PropTypes.string,
    end_date: PropTypes.string,
  }).isRequired,
  showActiveOnly: PropTypes.bool.isRequired,
  totalRows: PropTypes.number.isRequired
};

  

  const loginLogColumns = [
    { field: 'technician_email', headerName: 'Technician Email',flex: 1.2, 
      width: 220 },
    { 
        field: 'login_time_ist', 
        headerName: 'Login (IST / UTC)', 
        width: 230,
        flex: 1.5,
        renderCell: (params) => (
            <Box sx={{ display: 'flex', flexDirection: 'column', py: 1,justifyContent: 'center', 
              alignItems: 'center', }}>
                <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                    {params.row.login_time_ist || 'N/A'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    {params.row.login_time_utc ? `${params.row.login_time_utc} UTC` : ''}
                </Typography>
            </Box>
        )
    },
    { 
      field: 'logout_time_ist', 
      headerName: 'Logout (IST / UTC)', 
      flex: 1.2, 
      minWidth: 230,
      headerAlign: 'left',
      align: 'left',
      renderCell: (params) => (
          <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'flex-start', 
              height: '100%',
              py: 1 
          }}>
              {params.row.logout_time_ist ? (
                  <>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {params.row.logout_time_ist}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          {params.row.logout_time_utc ? `${params.row.logout_time_utc} UTC` : ''}
                      </Typography>
                  </>
              ) : params.row.login_time_ist ? (
                  /* Shifted slightly right to visually center under the date text */
                  <Box sx={{ pl: 4 }}> 
                      <Chip 
                          label="Active" 
                          size="small" 
                          color="success" 
                          variant="outlined" 
                          sx={{ fontWeight: 600, height: '20px', fontSize: '0.85rem' }} 
                      />
                  </Box>
              ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>N/A</Typography>
              )}
          </Box>
      )
  },  
  
    { field: 'user_ip', headerName: 'IP Address', flex: 1.2,width: 140 },
    { 
        field: 'logout_method', 
        headerName: 'Logout Method', 
        width: 150,
        flex: 1.2,
        renderCell: (params) => (
            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                {params.value || '-'}
            </Typography>
        )
    },
    { 
        field: 'device_agent', 
        headerName: 'Device Info', 
        width: 250,
        flex: 1.5,
        renderCell: (params) => (
            <Tooltip title={params.value || ""} arrow>
                <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
                    {params.value}
                </Typography>
            </Tooltip>
        )
    },
  ];

const filteredRows = useMemo(() => {
  return loginLogs.filter((row) => {
    // 1. Search Filter
    const matchesSearch = row.technician_email
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());

    // 2. Active Session Filter (New standalone state)
    const matchesActive = showActiveOnly ? !row.logout_time_ist : true;

    return matchesSearch && matchesActive;
  });
}, [loginLogs, searchQuery, showActiveOnly]); // Only needs showActiveOnly to trigger





const [searchMode, setSearchMode] = useState('range'); // 'single' or 'range'

const handleReset = () => {
  setFilters(defaultFilters);
  setSearchMode('range');
};

const handleApply = () => {
  // If in single mode, ensure end_date is null before sending to API
  const finalFilters = {
    ...filters,
    end_date: searchMode === 'single' ? null : filters.end_date
  };
  fetchLogs(finalFilters);
  setFilterOpen(false);
};

  return (
    <Box margin={2}>
      <Typography sx={{mt: -5, mb: 2}}  textAlign="center" variant="h5" color='primary' >
        Technician Login Activity
      </Typography>

      { ((loginLogs.length === 0 || filteredRows.length === 0) && loading === false) &&
        <Box position="absolute" sx={{top: '50%'}} width="100%" display="flex" alignItems="center" justifyContent="center">
          <CustomNoRowsOverlay/>
        </Box>
      }
      <DataGrid
        rows={filteredRows}
        columns={loginLogColumns}
        loading={loading}
        rowCount={totalRows}
        paginationMode="server"
        onPaginationModelChange={(newModel) => {
          fetchLogs(filters, newModel.page + 1, newModel.pageSize);
        }}
        // autoHeight
        rowHeight={65} 
        initialState={{ 
          pagination: { 
            paginationModel: { pageSize: 25 } 
          },
          columns: {
            columnVisibilityModel: {
              // Set the field name to false to hide it by default
              device_agent: false,
            },
          },
        }}
        pageSizeOptions={[25, 50, 100]}
        slots={{
          toolbar: CustomToolbar,
          noRowsOverlay: CustomNoRowsOverlay,
          loadingOverlay: LinearProgress,
          footer: CustomFooter,
        }}
        slotProps={{
          toolbar: { setFilterOpen, searchQuery, setSearchQuery ,showActiveOnly,setShowActiveOnly, userPermissions,availableEmails},
          footer: { 
             apiMetadata, 
             showActiveOnly,
             totalRows
          }
        }}
        sx={{width:'100%', textAlign: 'center', justifyContent: 'center', minHeight: '71vh', maxHeight: '75vh',
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 550
          },
          "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows" : {
            marginTop: 1.75,
          },
        }}
        disableRowSelectionOnClick
      />


  <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} fullWidth maxWidth="xs">
    <DialogTitle sx={{ fontWeight: 'bold' }}>Filter Logs</DialogTitle>
    <DialogContent>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          


          <Grid item xs={12}>
            <FormControl disabled={showActiveOnly}>
              <FormLabel sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Search Type</FormLabel>
              <RadioGroup
                row
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value)}
              >
                <FormControlLabel value="single" control={<Radio size="small" />} label="Single Day" />
                <FormControlLabel value="range" control={<Radio size="small" />} label="Date Range" />
              </RadioGroup>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <DatePicker
              label={searchMode === 'single' ? "Select Date" : "Start Date"}
              value={filters.start_date}
              maxDate={today}
              disabled={showActiveOnly}
              onChange={(val) => setFilters({ ...filters, start_date: val })}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>

          {searchMode === 'range' && (
            <Grid item xs={12}>
              <DatePicker
                label="End Date"
                value={filters.end_date}
                maxDate={today}
                disabled={showActiveOnly}
                onChange={(val) => setFilters({ ...filters, end_date: val })}
                slotProps={{ textField: { fullWidth: true } }}
                minDate={filters.start_date}
              />
            </Grid>
          )}

          <Grid item xs={12} sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button fullWidth variant="outlined" onClick={handleReset}>
              Reset
            </Button>
            <Button fullWidth variant="contained" onClick={handleApply}>
              Apply Date Filters
            </Button>
          </Grid>
        </Grid>
      </LocalizationProvider>
    </DialogContent>
  </Dialog>



      {showSnackbar && (
        <SnackbarDialog severity={snackBarMessage?.severity} message={snackBarMessage?.message} onClose={() => setShowSnackbar(false)} />
      )}
    </Box>
  );
}

UserLoginLogs.propTypes = {
  accessToken: PropTypes.string.isRequired,
    userPermissions: userPermissionsShape.isRequired
};

export default UserLoginLogs;
