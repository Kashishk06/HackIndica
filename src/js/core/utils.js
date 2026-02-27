// Toast notification system
export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s forwards";
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Email validation
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Phone validation
export function validatePhone(phone) {
  const re =
    /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  return re.test(phone);
}

// Format date – works with ISO strings and our JSON Timestamp objects
export function formatDate(timestamp) {
  if (!timestamp) return "N/A";
  // Handles { _isTimestamp: true, iso: '...' } from our JSON backend
  const raw = timestamp._isTimestamp ? timestamp.iso : timestamp;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Generate random color
export function getRandomColor() {
  const colors = [
    "#667eea",
    "#764ba2",
    "#9f7aea",
    "#ed64a6",
    "#48bb78",
    "#4299e1",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Local storage helpers
export const storage = {
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Error saving to localStorage", e);
    }
  },
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error("Error reading from localStorage", e);
      return null;
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Error removing from localStorage", e);
    }
  },
};

// Loading spinner
export function showLoading(container) {
  const loader = document.createElement("div");
  loader.className = "loading-spinner";
  loader.id = "global-loader";
  container.appendChild(loader);
}

export function hideLoading() {
  const loader = document.getElementById("global-loader");
  if (loader) {
    loader.remove();
  }
}

// Copy to clipboard
export function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showToast("Copied to clipboard!", "success");
    })
    .catch(() => {
      showToast("Failed to copy", "error");
    });
}

// Download as CSV
export function downloadCSV(data, filename) {
  const csv = data
    .map((row) =>
      row
        .map((cell) =>
          typeof cell === "string" ? `"${cell.replace(/"/g, '""')}"` : cell,
        )
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
