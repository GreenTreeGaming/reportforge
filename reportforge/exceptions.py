class ReportForgeError(Exception):
    """Base exception for user-correctable ReportForge errors."""


class UnsupportedFileError(ReportForgeError):
    """Raised when the uploaded file format is unsupported."""


class InvalidDataError(ReportForgeError):
    """Raised when uploaded data cannot be analyzed safely."""
