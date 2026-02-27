import authManager from "../core/auth.js";
import { showToast } from "../core/utils.js";

/**
 * Unified Auth Form Handler
 * @param {string} formId - The ID of the form element
 * @param {string} type - 'login' or 'register'
 * @param {string} btnId - ID of the submit button to handle loading state
 */
export function createAuthForm(formId, type, btnId) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById(btnId);
    const originalText = btn ? btn.innerHTML : "";

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML =
          '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
      }

      let user = null;

      if (type === "login") {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        user = await authManager.login(email, password);
      } else {
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword =
          document.getElementById("confirmPassword").value;
        const role = document.getElementById("role").value; // Hidden input or selector

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        user = await authManager.register({
          name,
          email,
          password,
          role,
          phone: "0000000000", // Default for now
        });
      }

      if (user) {
        // Success! The authManager already showed a toast and set the session.
        // We just need to redirect now.
        setTimeout(() => {
          authManager.redirectToDashboard(user.role);
        }, 1000);
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  });
}
