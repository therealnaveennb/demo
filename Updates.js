import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import { userPermissionsShape } from "../propTypes";

import {
  DataGrid,
  GridToolbarContainer,
  GridFooterContainer,
  GridFooter
} from '@mui/x-data-grid';

import {
  Box,
  LinearProgress,
  Typography,
  Grid,
  Button,
  Tooltip,
  TextField,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
  Switch,
  FormControlLabel,
  FormControl,
  FormLabel,
  Radio,
  RadioGroup
} from '@mui/material';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import FilterListIcon from '@mui/icons-material/FilterList';

import CustomNoRowsOverlay from '../components/table/CustomNoRowsOverlay';
import SnackbarDialog from '../components/dialogs/SnackbarDialog';


// ================= TOOLBAR =================
const CustomToolbar = React.memo(({
  setFilterOpen,
  searchQuery,
  setSearchQuery,
  showActiveOnly,
  setShowActiveOnly,
  userPermissions,
  availableEmails
}) => (
  <GridToolbarContainer sx={{ p: 1, display: 'flex', justifyContent: 'space-between' }}>
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Button
        startIcon={<FilterListIcon />}
        onClick={() => setFilterOpen(true)}
        size="small"
        variant="outlined"
      >
        Filters
      </Button>

      {userPermissions?.is_admin && (
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
            />
          }
          label="Show Active Sessions"
        />
      )}
    </Box>

    {userPermissions?.is_admin && (
      <Autocomplete
        size="small"
        options={availableEmails}
        value={searchQuery || null}
        onInputChange={(e, value) => setSearchQuery(value)}
        renderInput={(params) => (
          <TextField {...params} placeholder="Search Email..." />
        )}
        sx={{ width: 260 }}
      />
    )}
  </GridToolbarContainer>
));


// ================= MAIN =================
function UserLoginLogs({ accessToken, userPermissions }) {

  const today = dayjs();

  const defaultFilters = {
    start_date: dayjs().subtract(24, 'hour'),
    end_date: today
  };

  const [loginLogs, setLoginLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [apiMetadata, setApiMetadata] = useState({});
  const [availableEmails, setAvailableEmails] = useState([]);
  const [searchMode, setSearchMode] = useState('range');

  const [snackBarMessage, setSnackBarMessage] = useState(null);
  const [showSnackbar, setShowSnackbar] = useState(false);


  // ================= FETCH USERS =================
  const fetchAllUsers = useCallback(async (role) => {
    let page = 1;
    let emails = [];

    try {
      while (true) {
        const { data } = await axios.get(
          `${process.env.REACT_APP_BACKEND}/api/settings/users/${role}/`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { page, page_size: 50 }
          }
        );

        emails.push(...data.results.map(u => u.email));

        if (!data.next) break;
        page++;
      }

      return emails;

    } catch {
      return [];
    }
  }, [accessToken]);


  useEffect(() => {
    const loadEmails = async () => {
      const [a, b] = await Promise.all([
        fetchAllUsers('superuser'),
        fetchAllUsers('technician')
      ]);

      setAvailableEmails([...new Set([...a, ...b])]);
    };

    loadEmails();
  }, [fetchAllUsers]);


  // ================= FETCH LOGS =================
  const fetchLogs = useCallback(async (appliedFilters = filters, page = 1, pageSize = 25) => {
    setLoading(true);

    try {
      const params = {
        active_only: showActiveOnly,
        search: searchQuery,
        page,
        page_size: pageSize,
        ...(appliedFilters.start_date && {
          start_date: appliedFilters.start_date.format('YYYY-MM-DD')
        }),
        ...(appliedFilters.end_date && {
          end_date: appliedFilters.end_date.format('YYYY-MM-DD')
        }),
      };

      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND}/api/user/login-activity/`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params
        }
      );

      const payload = data?.results;

      setLoginLogs(payload?.results || []);
      setApiMetadata(payload?.metadata || {});
      setTotalRows(data?.count || 0);

    } catch {
      setSnackBarMessage({ severity: 'error', message: "Failed to fetch logs" });
      setShowSnackbar(true);
    } finally {
      setLoading(false);
    }

  }, [filters, searchQuery, showActiveOnly, accessToken]);


  // ================= DEBOUNCE =================
  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, showActiveOnly, fetchLogs]);


  // ================= COLUMNS =================
  const columns = [
    { field: 'technician_email', headerName: 'Email', flex: 1 },

    {
      field: 'login_time_ist',
      headerName: 'Login',
      flex: 1,
    },

    {
      field: 'logout_time_ist',
      headerName: 'Logout',
      flex: 1,
      renderCell: (params) =>
        params.value ? params.value : (
          <Chip label="Active" size="small" color="success" />
        )
    },

    { field: 'user_ip', headerName: 'IP', flex: 1 },
    { field: 'logout_method', headerName: 'Method', flex: 1 },

    {
      field: 'device_agent',
      headerName: 'Device',
      flex: 1,
      renderCell: (params) => (
        <Tooltip title={params.value}>
          <Typography noWrap>{params.value}</Typography>
        </Tooltip>
      )
    }
  ];


  // ================= HANDLERS =================
  const handleApply = () => {
    fetchLogs(filters);
    setFilterOpen(false);
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    setSearchMode('range');
  };


  // ================= UI =================
  return (
    <Box m={2}>

      <Typography textAlign="center" variant="h5" mb={2}>
        Technician Login Activity
      </Typography>

      <DataGrid
        rows={loginLogs}
        columns={columns}
        loading={loading}
        rowCount={totalRows}
        paginationMode="server"
        onPaginationModelChange={(model) => {
          fetchLogs(filters, model.page + 1, model.pageSize);
        }}
        pageSizeOptions={[25, 50, 100]}
        slots={{
          toolbar: CustomToolbar,
          loadingOverlay: LinearProgress,
          noRowsOverlay: CustomNoRowsOverlay
        }}
        slotProps={{
          toolbar: {
            setFilterOpen,
            searchQuery,
            setSearchQuery,
            showActiveOnly,
            setShowActiveOnly,
            userPermissions,
            availableEmails
          }
        }}
        sx={{ minHeight: '70vh' }}
      />


      {/* FILTER MODAL */}
      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)}>
        <DialogTitle>Filters</DialogTitle>
        <DialogContent>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2} mt={1}>

              <Grid item xs={12}>
                <FormControl>
                  <FormLabel>Search Type</FormLabel>
                  <RadioGroup row value={searchMode}
                    onChange={(e) => setSearchMode(e.target.value)}>
                    <FormControlLabel value="single" control={<Radio />} label="Single" />
                    <FormControlLabel value="range" control={<Radio />} label="Range" />
                  </RadioGroup>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <DatePicker
                  label="Start"
                  value={filters.start_date}
                  onChange={(val) => setFilters({ ...filters, start_date: val })}
                />
              </Grid>

              {searchMode === 'range' && (
                <Grid item xs={12}>
                  <DatePicker
                    label="End"
                    value={filters.end_date}
                    onChange={(val) => setFilters({ ...filters, end_date: val })}
                  />
                </Grid>
              )}

              <Grid item xs={12} display="flex" gap={1}>
                <Button fullWidth onClick={handleReset}>Reset</Button>
                <Button fullWidth variant="contained" onClick={handleApply}>
                  Apply
                </Button>
              </Grid>

            </Grid>
          </LocalizationProvider>

        </DialogContent>
      </Dialog>


      {showSnackbar && (
        <SnackbarDialog
          severity={snackBarMessage?.severity}
          message={snackBarMessage?.message}
          onClose={() => setShowSnackbar(false)}
        />
      )}

    </Box>
  );
}


// ================= PROPS =================
UserLoginLogs.propTypes = {
  accessToken: PropTypes.string.isRequired,
  userPermissions: userPermissionsShape.isRequired
};

export default UserLoginLogs;
