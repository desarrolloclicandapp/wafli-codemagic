const { ApiError } = require("../utils/responses");

async function sendMail() {
  throw new ApiError(
    410,
    "email_auth_removed",
    "El acceso por correo fue reemplazado por Google y Apple Sign-In."
  );
}

async function verifySmtp() {
  return {
    configured: false,
    ok: false,
    disabled: true,
    error: "email_auth_removed",
    message: "El acceso por correo fue reemplazado por Google y Apple Sign-In."
  };
}

module.exports = { sendMail, verifySmtp };
