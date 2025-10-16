function summarizeError(error) {
  if (!error) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  return (
    error?.error?.error_summary ||
    error?.message ||
    error?.description ||
    error?.toString?.() ||
    "Unknown error"
  );
}

function isDropboxNotFound(error) {
  if (!error) {
    return false;
  }

  const status = error.status || error.statusCode;
  const summary = error?.error?.error_summary || "";
  return status === 409 && typeof summary === "string" && summary.includes("not_found");
}

module.exports = {
  summarizeError,
  isDropboxNotFound,
};
