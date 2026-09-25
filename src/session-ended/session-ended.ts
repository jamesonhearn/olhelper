import "./session-ended.css";

Office.onReady((info) => {
  if (info.host === Office.HostType.Outlook) {
    initializeOfficeTheme();
  }

  document.getElementById("close-pane")!.addEventListener("click", () => {
    document.getElementById("close-status")!.textContent =
      "Closing the OLHelper task pane.";
    Office.context.ui.closeContainer();
  });
});

function initializeOfficeTheme(): void {
  if (!Office.context.requirements.isSetSupported("Mailbox", "1.14")) {
    return;
  }

  applyOfficeTheme(Office.context.officeTheme);
  Office.context.mailbox.addHandlerAsync(
    Office.EventType.OfficeThemeChanged,
    (event: Office.OfficeThemeChangedEventArgs) => {
      applyOfficeTheme(event.officeTheme);
    },
  );
}

function applyOfficeTheme(theme: Office.OfficeTheme): void {
  setThemeColor("--body-background", theme.bodyBackgroundColor);
  setThemeColor("--body-foreground", theme.bodyForegroundColor);
  setThemeColor("--surface-background", theme.controlBackgroundColor);
  setThemeColor("--border-color", theme.controlForegroundColor);
  document.documentElement.dataset.officeTheme = isDarkColor(
    theme.bodyBackgroundColor,
  )
    ? "dark"
    : "light";
}

function setThemeColor(property: string, value: string): void {
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    document.documentElement.style.setProperty(property, value);
  }
}

function isDarkColor(value: string): boolean {
  const match = /^#([0-9a-f]{6})$/i.exec(value);

  if (!match) {
    return false;
  }

  const color = Number.parseInt(match[1], 16);
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return red * 0.299 + green * 0.587 + blue * 0.114 < 128;
}
