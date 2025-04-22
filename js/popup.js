document.addEventListener('DOMContentLoaded', () => {
  // 获取按钮元素
  const openBookmarksButton = document.getElementById('openBookmarks');
  const openBookmarkManagerButton = document.getElementById('openBookmarkManager');
  
  // 添加点击事件，点击后打开书签栏页面
  openBookmarksButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'bookmarks.html' });
  });
  
  // 添加点击事件，点击后打开Chrome书签管理页面
  openBookmarkManagerButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://bookmarks/' });
  });
  
  // 预览卡片添加点击效果
  const previewCards = document.querySelectorAll('.preview-card');
  previewCards.forEach(card => {
    card.addEventListener('click', () => {
      chrome.tabs.create({ url: 'bookmarks.html' });
    });
  });
}); 