class AppException(Exception):
    def __init__(self, message: str = "Internal error", code: int = 1):
        self.message = message
        self.code = code
        super().__init__(message)

class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message=message, code=404)
