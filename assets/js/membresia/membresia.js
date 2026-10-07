"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("premiumButton");
  const status = document.getElementById("membershipStatus");

  if (!button || !status) {
    return;
  }

  button.addEventListener("click", function () {
    status.textContent =
      "La membresía Premium estará disponible próximamente.";
  });
});
