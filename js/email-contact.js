(function () {
  function encode(value) {
    return encodeURIComponent(String(value || ""));
  }

  function buildMailto(to, subject, body) {
    const params = [];
    if (subject) {
      params.push("subject=" + encode(subject));
    }
    if (body) {
      params.push("body=" + encode(body));
    }
    return "mailto:" + to + (params.length ? "?" + params.join("&") : "");
  }

  function buildGmailUrl(to, subject, body) {
    const params = ["view=cm", "fs=1", "to=" + encode(to)];
    if (subject) {
      params.push("su=" + encode(subject));
    }
    if (body) {
      params.push("body=" + encode(body));
    }
    return "https://mail.google.com/mail/?" + params.join("&");
  }

  function buildOutlookUrl(to, subject, body) {
    const params = ["to=" + encode(to)];
    if (subject) {
      params.push("subject=" + encode(subject));
    }
    if (body) {
      params.push("body=" + encode(body));
    }
    return "https://outlook.office.com/mail/deeplink/compose?" + params.join("&");
  }

  function openEmail(link) {
    const to = link.getAttribute("data-mail-to") || "manapaioniajapan@gmail.com";
    const subject = link.getAttribute("data-mail-subject") || "";
    const body = link.getAttribute("data-mail-body") || "";

    const mailtoUrl = buildMailto(to, subject, body);
    const gmailUrl = buildGmailUrl(to, subject, body);
    const outlookUrl = buildOutlookUrl(to, subject, body);

    let pageHidden = false;
    const onVisibilityChange = function () {
      if (document.hidden) {
        pageHidden = true;
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.location.href = mailtoUrl;

    window.setTimeout(function () {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (pageHidden) {
        return;
      }

      const openGmail = window.confirm("メールアプリを開けなかったため、Gmailで開きますか？\nキャンセルを押すとOutlookで開きます。");
      const fallbackUrl = openGmail ? gmailUrl : outlookUrl;
      window.open(fallbackUrl, "_blank", "noopener");
    }, 1000);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const links = document.querySelectorAll("a[data-email-contact='1']");
    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (event.defaultPrevented || event.button !== 0) {
          return;
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }

        event.preventDefault();
        openEmail(link);
      });
    });
  });
})();
