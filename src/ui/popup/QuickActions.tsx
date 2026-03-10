function openSidePanel() {
  if (chrome.sidePanel?.open) {
    chrome.windows.getCurrent((win) => {
      if (win.id !== undefined) {
        chrome.sidePanel.open({ windowId: win.id });
      }
    });
  } else {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  }
  window.close();
}

function openOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

export function QuickActions() {
  return (
    <div className="quick-actions">
      <p className="quick-actions__heading">Quick Actions</p>

      <button className="quick-actions__btn" onClick={openSidePanel}>
        <span className="quick-actions__icon">&#9711;</span>
        Open Side Panel
      </button>

      <button className="quick-actions__btn" onClick={openOptions}>
        <span className="quick-actions__icon">&#9881;</span>
        Options
      </button>
    </div>
  );
}
