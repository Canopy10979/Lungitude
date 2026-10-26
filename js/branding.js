/* Show the supplied local PNG when available; retain the existing brand if it is missing. */
(function () {
    "use strict";
    document.querySelectorAll(".brand-icon").forEach(function (fallback) {
        const logo = new Image();
        logo.className = "lungitude-logo";
        logo.alt = "";
        logo.addEventListener("load", function () {
            fallback.replaceWith(logo);
        });
        logo.src = "assets/lungitude-logo.png";
    });
})();
