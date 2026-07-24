"""
Development email provider: logs the email instead of sending it, so
auth flows (email verification, password reset) are fully testable
without a paid/external email service. A real provider (e.g. an SMTP
relay or a transactional-email API) is a later, separately-scoped
decision -- swapping it in only needs EMAIL_PROVIDER changed and a new
class added here, per app/email/factory.py.
"""

import logging

from app.email.provider import EmailProvider

logger = logging.getLogger("app.email.console")


class ConsoleEmailProvider(EmailProvider):
    def send_email(self, to: str, subject: str, body: str) -> None:
        logger.info("EMAIL to=%s subject=%r\n%s", to, subject, body)
