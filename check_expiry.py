import logging
from typing import Optional
from datetime import datetime
import csv

from botocore.exceptions import ClientError
from django.core.management.base import BaseCommand
from requests.exceptions import HTTPError

from api.models import Service
from api.views.views_util import get_class_by_service_name
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from django.conf import settings

logger = logging.getLogger("django")


class Command(BaseCommand):
    help = 'Token expiry check for service instances'

    def handle(self, *args, **kwargs):
        _ = (args, kwargs)
        services = Service.objects.all()
        total_services = services.count()
        updated_services = 0

        logger.info("Starting token expiry checks for %s service(s).",total_services)
        
        for service in services:
            plugin = (service.configurations or {}).get("plugin", "").strip().lower()
            expiry_state = self.check_service_expiry(service, plugin)
            
            if expiry_state is not None:
                if service.is_expired != expiry_state:
                    service.is_expired = expiry_state
                    service.save(update_fields=["is_expired"])
                    updated_count += 1
                
                issue_list.append({
                    "key": service.name,
                    "issue_type": f"Plugin: {plugin or 'unknown'} (Expired: {expiry_state})"
                })
        
        if issue_list:

            csv_path = self.generate_csv_report(issue_list)
            
            email_creds = {
                'recipient_email': "admin@example.com",
                'email_sender': settings.DEFAULT_FROM_EMAIL,
                'cc_email': "",
                'email_password': "your-password",
                'smtp_user': "your-smtp-user",
                'smtp_server': "smtp.gmail.com",
                'smtp_port': 587,
            }
            self.send_report_email(issue_list, "System Services", email_creds, csv_path)


            if service.is_expired != expiry_state:
                service.is_expired = expiry_state
                service.save(update_fields=["is_expired"])
                updated_services += 1

            print(
                f"{service.name} ({plugin or 'unknown'}) -> is_expired={service.is_expired}"
            )

        print(
            "Completed token expiry checks. "
            f"Updated {updated_services} service(s)."
        )

    def check_service_expiry(self, service: Service, plugin: str) -> Optional[bool]:
        if plugin in ("cursor","assist","custom","license","zabbix","passbolt"):
            return None
        if plugin == "aws":
            return self.check_aws_expiry(service)
        if plugin == "zendesk":
            return self.check_zendesk_expiry(service)
        if plugin == "jenkins":
            return self.check_jenkins_expiry(service)
        if plugin == "sentry":
            return self.check_sentry_expiry(service)
        if plugin == "wordpress":
            return self.check_wordpress_expiry(service)
        if plugin == "gitlab":
            return self.check_gitlab_expiry(service)
        if plugin == "hubspot":
            return self.check_hubspot_expiry(service)
        if plugin == "snipeit":
            return self.check_snipeit_expiry(service)
        return None


    def check_aws_expiry(self, service: Service) -> Optional[bool]:
        try:
            service_class_instance = get_class_by_service_name(service.name)
            service_class_instance.update_users()
            return False
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code == "InvalidClientTokenId":
                return True
            return None
        except Exception as exc:
            logger.error(
                "Token check failed for service %s (aws): %s",
                service.name,
                exc,
                exc_info=True,
            )
            return None

    def check_zendesk_expiry(self, service: Service) -> Optional[bool]:
        if (service.configurations or {}).get("authType") != "personal":
            return None
        try:
            service_class_instance = get_class_by_service_name(service.name)
            service_class_instance.update_users()
            return False
        except HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 401:
                return True
            return None
        except Exception as exc:
            logger.error(
                "Token check failed for service %s (zendesk): %s",
                service.name,
                exc,
                exc_info=True,
            )
            return None

    def check_jenkins_expiry(self, service: Service) -> Optional[bool]:
        try:
            service_class_instance = get_class_by_service_name(service.name)
            service_class_instance.update_users()
            return False
        except HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 401:
                return True
            return None
        except Exception as exc:
            logger.error(
                "Token check failed for service %s (jenkins): %s",
                service.name,
                exc,
                exc_info=True,
            )
            return None

    def check_sentry_expiry(self, service: Service) -> Optional[bool]:
        if (service.configurations or {}).get("authType") != "personal":
            return None
        try:
            service_class_instance = get_class_by_service_name(service.name)
            service_class_instance.update_users()
            return False
        except HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 401:
                return True
            return None
        except Exception as exc:
            logger.error(
                "Token check failed for service %s (sentry): %s",
                service.name,
                exc,
                exc_info=True,
            )
            return None

    def check_wordpress_expiry(self, service: Service) -> Optional[bool]:
        try:
            service_class_instance = get_class_by_service_name(service.name)
            service_class_instance.update_users()
            return False
        except HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 401:
                return True
            return None
        except Exception as exc:
            logger.error(
                "Token check failed for service %s (wordpress): %s",
                service.name,
                exc,
                exc_info=True,
            )
            return None

    def check_gitlab_expiry(self, service: Service) -> Optional[bool]:
        auth_type = (service.configurations or {}).get("authType")
        try:
            service_class_instance = get_class_by_service_name(service.name)
            service_class_instance.update_users()
            return False
        except PermissionError as exc:
            msg = str(exc)
            if "GitLab Authentication Failed (401)" not in msg:
                return None
            if auth_type == "personal":
                return True if "invalid_token" in msg else None
            if "invalid_token" in msg or "401 Unauthorized" in msg:
                return True
            return None
        except Exception as exc:
            logger.error(
                "Token check failed for service %s (gitlab): %s",
                service.name,
                exc,
                exc_info=True,
            )
            return None

    def check_hubspot_expiry(self, service: Service) -> Optional[bool]:
        try:
            service_class_instance = get_class_by_service_name(service.name)
            service_class_instance.update_users()
            return False
        except HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 401:
                return True
            return None
        except Exception as exc:
            logger.error(
                "Token check failed for service %s (hubspot): %s",
                service.name,
                exc,
                exc_info=True,
            )
            return None

    def check_snipeit_expiry(self, service: Service) -> Optional[bool]:
        if (service.configurations or {}).get("authType") != "personal":
            return None
        try:
            service_class_instance = get_class_by_service_name(service.name)
            service_class_instance.update_users()
            service_class_instance.sync_assets()
            return False
        except HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 401:
                return True
            return None
        except ValueError as exc:
            msg = str(exc)
            if "7000222" in msg or "AADSTS7000222" in msg:
                return True
            return None
        except Exception as exc:
            logger.error(
                "Token check failed for service %s (snipeit): %s",
                service.name,
                exc,
                exc_info=True,
            )
            return None
    
    def generate_csv_report(self, issue_list):
        file_path = "/tmp/service_report.csv"
        with open(file_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["key", "issue_type"])
            writer.writeheader()
            writer.writerows(issue_list)
        return file_path
    
    def build_html_body(self, domain, reason, title, issue_data):
        table_rows = "".join([
            f'<tr><td style="padding: 10px; border: 1px solid #ddd;">{issue["key"]}</td>'
            f'<td style="padding: 10px; border: 1px solid #ddd;">{issue["issue_type"]}</td></tr>'
            for issue in issue_data
        ])
        return f"""
        <html>
            <body style="font-family: Arial;">
                <h2>{title} Report</h2>
                <p><strong>Domain:</strong> {domain} | <strong>Reason:</strong> {reason}</p>
                <p><strong>Date:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <table style="border-collapse: collapse; width: 100%;">
                    <tr style="background-color: #f2f2f2;"><th>Service Name</th><th>Details</th></tr>
                    {table_rows}
                </table>
            </body>
        </html>
        """

    def send_report_email(self, issue_list, domain, email_creds, csv_path):
        subject = f"Service Alert: {len(issue_list)} Tokens Checked"
        reason = "Automated scheduled token validation."
        title = "Service Token Status"
        
        html_body = self.build_html_body(domain, reason, title, issue_list)
        
        msg = MIMEMultipart()
        msg['Subject'] = subject
        msg['From'] = email_creds['email_sender']
        msg['To'] = email_creds['recipient_email']
        
        msg.attach(MIMEText(html_body, 'html'))
        
        with open(csv_path, "rb") as f:
            part = MIMEApplication(f.read(), Name="expiry_report.csv")
            part.add_header('Content-Disposition', 'attachment', filename="expiry_report.csv")
            msg.attach(part)

        try:
            server = smtplib.SMTP(email_creds['smtp_server'], int(email_creds['smtp_port']))
            server.starttls()
            server.login(email_creds['smtp_user'], email_creds['email_password'])
            server.sendmail(msg['From'], [msg['To']], msg.as_string())
            server.quit()
        except Exception as e:
            logger.error(f"Mail failed: {e}")

