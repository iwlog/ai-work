document.addEventListener("DOMContentLoaded", function () {
  var navToggle = document.querySelector(".nav-toggle");
  var mainNav = document.querySelector(".main-nav");

  if (navToggle && mainNav) {
    var closeNav = function () {
      mainNav.classList.remove("is-open");
      navToggle.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    };

    navToggle.addEventListener("click", function () {
      var isOpen = mainNav.classList.toggle("is-open");
      navToggle.classList.toggle("is-open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
  }

  var messageInput = document.querySelector("#message");
  var messageCount = document.querySelector("#message-count");

  if (messageInput && messageCount) {
    var maxLength = Number(messageInput.getAttribute("maxlength")) || 0;

    var updateMessageCount = function () {
      var remaining = maxLength - messageInput.value.length;
      messageCount.textContent = "残り" + remaining + "文字";
    };

    messageInput.addEventListener("input", updateMessageCount);
    updateMessageCount();
  }

  var contactForm = document.querySelector("#contact-form");
  var submitButton = contactForm
    ? contactForm.querySelector('button[type="submit"]')
    : null;

  if (contactForm && submitButton) {
    var submitButtonDefaultText = submitButton.textContent;

    contactForm.addEventListener("submit", function () {
      submitButton.disabled = true;
      submitButton.textContent = "送信中…";
    });

    window.addEventListener("pageshow", function () {
      submitButton.disabled = false;
      submitButton.textContent = submitButtonDefaultText;
    });
  }
});
