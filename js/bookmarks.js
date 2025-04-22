document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素
  const bookmarkTree = document.getElementById('bookmarkTree');
  const searchBox = document.getElementById('searchBox');
  const sidebarContent = document.querySelector('.sidebar-content');
  const breadcrumbsNav = document.querySelector('.breadcrumbs-navigation');
  const folderTitle = document.querySelector('.current-folder-title');
  const viewButtons = document.querySelectorAll('.view-button');
  const sidebarHeader = document.getElementById('sidebarHeader');
  
  // 状态变量
  let allBookmarks = [];
  let currentPath = [];
  let currentView = 'grid'; // 'grid' 或 'list'
  
  // 初始化
  init();
  
  // 初始化应用
  function init() {
    // 给侧边栏标题添加点击事件，点击返回主页
    sidebarHeader.addEventListener('click', () => {
      navigateToRoot();
    });
    
    // 设置样式，让用户知道标题可点击
    sidebarHeader.style.cursor = 'pointer';
    
    // 加载书签栏内容
    chrome.bookmarks.getChildren('1', (bookmarkNodes) => {
      // 加载侧边栏导航
      renderSidebarNavigation(bookmarkNodes);
      
      // 加载主内容区
      renderBookmarksInMainArea(bookmarkNodes);
      
      // 收集所有书签（用于搜索）
      collectAllBookmarks(bookmarkNodes);
    });
    
    // 初始化视图切换
    initViewControls();
    
    // 更新面包屑导航
    updateBreadcrumbs();
  }
  
  // 初始化视图控制
  function initViewControls() {
    viewButtons.forEach(button => {
      button.addEventListener('click', () => {
        // 获取视图类型
        const viewType = button.getAttribute('data-view');
        
        // 更新激活状态
        viewButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // 切换视图
        currentView = viewType;
        
        // 重新渲染当前内容
        if (currentPath.length === 0) {
          chrome.bookmarks.getChildren('1', (bookmarkNodes) => {
            renderBookmarksInMainArea(bookmarkNodes);
          });
        } else {
          const currentFolder = currentPath[currentPath.length - 1];
          chrome.bookmarks.getChildren(currentFolder.id, (bookmarkNodes) => {
            renderBookmarksInMainArea(bookmarkNodes);
          });
        }
      });
    });
  }
  
  // 渲染侧边栏导航
  function renderSidebarNavigation(bookmarkNodes) {
    sidebarContent.innerHTML = '';
    
    // 只显示文件夹
    const folders = bookmarkNodes.filter(node => !node.url);
    
    // 如果没有文件夹，显示提示信息
    if (folders.length === 0) {
      const noFolders = document.createElement('div');
      noFolders.className = 'no-folders';
      noFolders.textContent = '没有文件夹';
      sidebarContent.appendChild(noFolders);
      return;
    }
    
    // 创建文件夹列表
    folders.forEach(folder => {
      const navItem = document.createElement('div');
      navItem.className = 'nav-item';
      navItem.dataset.folderId = folder.id;
      navItem.dataset.folderTitle = folder.title;
      
      // 检查是否为当前活动文件夹
      if (currentPath.length > 0 && currentPath[currentPath.length - 1].id === folder.id) {
        navItem.classList.add('active');
      }
      
      // 文件夹图标
      const icon = document.createElement('span');
      icon.className = 'material-symbols-rounded nav-icon';
      icon.textContent = 'folder';
      
      // 文件夹名称
      const text = document.createElement('span');
      text.className = 'nav-text';
      text.textContent = folder.title;
      
      navItem.appendChild(icon);
      navItem.appendChild(text);
      
      // 添加点击事件
      navItem.addEventListener('click', () => {
        // 导航到此文件夹
        navigateToFolder(folder.id, folder.title);
      });
      
      sidebarContent.appendChild(navItem);
    });
  }
  
  // 更新面包屑导航
  function updateBreadcrumbs() {
    breadcrumbsNav.innerHTML = '';
    
    // 添加根目录（书签栏）
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item';
    rootItem.textContent = '书签栏';
    rootItem.setAttribute('data-id', '1');
    
    rootItem.addEventListener('click', () => {
      // 导航到根目录
      navigateToRoot();
    });
    
    breadcrumbsNav.appendChild(rootItem);
    
    // 添加当前路径中的文件夹
    currentPath.forEach((folder, index) => {
      // 添加分隔符
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.innerHTML = ' &gt; ';
      breadcrumbsNav.appendChild(separator);
      
      // 添加文件夹
      const folderItem = document.createElement('span');
      folderItem.className = 'breadcrumb-item';
      folderItem.textContent = folder.title;
      folderItem.setAttribute('data-id', folder.id);
      
      // 只有非最后一项添加点击事件
      if (index < currentPath.length - 1) {
        folderItem.addEventListener('click', () => {
          // 导航到此文件夹，截断后续路径
          currentPath = currentPath.slice(0, index + 1);
          navigateToFolder(folder.id, folder.title);
        });
      }
      
      breadcrumbsNav.appendChild(folderItem);
    });
  }
  
  // 导航到根目录
  function navigateToRoot() {
    // 清空当前路径
    currentPath = [];
    
    // 更新标题
    folderTitle.textContent = '我的书签';
    
    // 更新面包屑
    updateBreadcrumbs();
    
    // 加载书签栏内容
    chrome.bookmarks.getChildren('1', (bookmarkNodes) => {
      renderSidebarNavigation(bookmarkNodes);
      renderBookmarksInMainArea(bookmarkNodes);
    });
  }
  
  // 导航到指定文件夹
  function navigateToFolder(folderId, folderTitle) {
    // 检查是否已在当前路径中
    const existingIndex = currentPath.findIndex(folder => folder.id === folderId);
    
    if (existingIndex !== -1) {
      // 如果已存在，截断路径到此文件夹
      currentPath = currentPath.slice(0, existingIndex + 1);
    } else {
      // 添加到路径
      currentPath.push({
        id: folderId,
        title: folderTitle
      });
    }
    
    // 更新文件夹标题
    document.querySelector('.current-folder-title').textContent = folderTitle;
    
    // 更新面包屑
    updateBreadcrumbs();
    
    // 显示加载提示
    bookmarkTree.innerHTML = '<div class="loading-folder">加载中...</div>';
    
    // 加载文件夹内容
    chrome.bookmarks.getChildren(folderId, (bookmarkNodes) => {
      // 更新侧边栏导航
      chrome.bookmarks.getChildren('1', renderSidebarNavigation);
      
      // 更新主内容区
      renderBookmarksInMainArea(bookmarkNodes);
    });
  }
  
  // 渲染书签到主内容区
  function renderBookmarksInMainArea(bookmarkNodes) {
    bookmarkTree.innerHTML = '';
    
    // 如果没有书签或文件夹
    if (bookmarkNodes.length === 0) {
      const noContent = document.createElement('div');
      noContent.className = 'no-results';
      noContent.innerHTML = `
        <span class="material-symbols-rounded no-results-icon">folder_off</span>
        <span>此文件夹为空</span>
      `;
      bookmarkTree.appendChild(noContent);
      return;
    }
    
    // 根据当前视图创建内容容器
    const container = document.createElement('div');
    container.className = currentView === 'grid' ? 'bookmarks-grid' : 'bookmarks-list';
    
    // 渲染书签节点
    bookmarkNodes.forEach(node => {
      if (node.url) {
        // 书签
        container.appendChild(currentView === 'grid' 
          ? createBookmarkGridItem(node) 
          : createBookmarkListItem(node));
      } else {
        // 文件夹
        container.appendChild(currentView === 'grid' 
          ? createFolderGridItem(node) 
          : createFolderListItem(node));
      }
    });
    
    bookmarkTree.appendChild(container);
  }
  
  // 创建网格视图的书签项
  function createBookmarkGridItem(bookmark) {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    
    const link = document.createElement('a');
    link.href = bookmark.url;
    link.target = "_blank";
    link.className = 'bookmark-link';
    
    // 图标容器
    const iconContainer = document.createElement('div');
    iconContainer.className = 'icon-container';
    
    // 图标
    const domain = extractDomain(bookmark.url);
    const img = document.createElement('img');
    img.className = 'favicon';
    img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    img.onerror = function() {
      this.src = getFallbackIcon(domain);
    };
    
    iconContainer.appendChild(img);
    link.appendChild(iconContainer);
    
    // 标题
    const title = document.createElement('div');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title || domain;
    link.appendChild(title);
    
    card.appendChild(link);
    return card;
  }
  
  // 创建列表视图的书签项
  function createBookmarkListItem(bookmark) {
    const item = document.createElement('div');
    item.className = 'bookmark-list-item';
    
    // 书签链接
    const link = document.createElement('a');
    link.href = bookmark.url;
    link.target = "_blank";
    link.style.textDecoration = 'none';
    link.style.color = 'inherit';
    link.style.display = 'flex';
    link.style.alignItems = 'center';
    link.style.width = '100%';
    
    // 图标
    const domain = extractDomain(bookmark.url);
    const img = document.createElement('img');
    img.className = 'bookmark-list-icon';
    img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    img.onerror = function() {
      this.src = getFallbackIcon(domain);
    };
    
    // 标题
    const title = document.createElement('div');
    title.className = 'bookmark-list-title';
    title.textContent = bookmark.title || domain;
    
    // URL
    const url = document.createElement('div');
    url.className = 'bookmark-list-url';
    url.textContent = bookmark.url;
    
    link.appendChild(img);
    link.appendChild(title);
    link.appendChild(url);
    
    item.appendChild(link);
    return item;
  }
  
  // 创建网格视图的文件夹项
  function createFolderGridItem(folder) {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.dataset.folderId = folder.id;
    card.dataset.folderTitle = folder.title;
    
    const folderLink = document.createElement('div');
    folderLink.className = 'folder-link';
    
    // 图标容器
    const iconContainer = document.createElement('div');
    iconContainer.className = 'icon-container folder-icon-container';
    
    // 文件夹图标
    const icon = document.createElement('span');
    icon.className = 'material-symbols-rounded';
    icon.textContent = 'folder';
    iconContainer.appendChild(icon);
    
    folderLink.appendChild(iconContainer);
    
    // 文件夹标题
    const title = document.createElement('div');
    title.className = 'folder-title';
    title.textContent = folder.title;
    folderLink.appendChild(title);
    
    card.appendChild(folderLink);
    
    // 添加点击事件
    card.addEventListener('click', function() {
      const folderId = this.dataset.folderId;
      const folderTitle = this.dataset.folderTitle;
      
      // 导航到此文件夹
      navigateToFolder(folderId, folderTitle);
    });
    
    return card;
  }
  
  // 创建列表视图的文件夹项
  function createFolderListItem(folder) {
    const item = document.createElement('div');
    item.className = 'bookmark-list-item';
    item.dataset.folderId = folder.id;
    item.dataset.folderTitle = folder.title;
    item.style.cursor = 'pointer';
    
    // 图标容器
    const icon = document.createElement('span');
    icon.className = 'material-symbols-rounded bookmark-list-icon';
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.backgroundColor = 'rgba(96, 165, 250, 0.12)';
    icon.style.color = 'var(--folder-icon-color)';
    icon.textContent = 'folder';
    
    // 标题
    const title = document.createElement('div');
    title.className = 'bookmark-list-title';
    title.textContent = folder.title;
    
    // 子项计数器
    const counter = document.createElement('div');
    counter.className = 'bookmark-list-url';
    
    // 获取子项数量
    chrome.bookmarks.getChildren(folder.id, (children) => {
      counter.textContent = `${children.length} 项`;
    });
    
    item.appendChild(icon);
    item.appendChild(title);
    item.appendChild(counter);
    
    // 添加点击事件
    item.addEventListener('click', function() {
      const folderId = this.dataset.folderId;
      const folderTitle = this.dataset.folderTitle;
      
      // 导航到此文件夹
      navigateToFolder(folderId, folderTitle);
    });
    
    return item;
  }
  
  // 提取域名
  function extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
      return url ? url.split('/')[2] || url : '';
    }
  }
  
  // 获取备用图标
  function getFallbackIcon(letter) {
    if (!letter) letter = '?';
    letter = letter.charAt(0).toUpperCase();
    
    // 基于字母的不同颜色
    const colors = [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7', 
      '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', 
      '#009688', '#4caf50', '#8bc34a', '#cddc39', 
      '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
    ];
    
    const charCode = letter.charCodeAt(0);
    const colorIndex = charCode % colors.length;
    const color = colors[colorIndex];
    
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="10" fill="${color}"/><text x="50" y="62" font-size="50" text-anchor="middle" fill="white" font-family="Arial, sans-serif">${letter}</text></svg>`;
  }

  // 收集所有书签
  function collectAllBookmarks(nodes, path = '') {
    nodes.forEach(node => {
      const currentPath = path ? `${path} > ${node.title}` : node.title;
      
      if (node.url) {
        allBookmarks.push({
          title: node.title,
          url: node.url,
          path: currentPath
        });
      }
      
      // 递归收集子书签
      if (!node.url) {
        chrome.bookmarks.getChildren(node.id, (children) => {
          if (children && children.length > 0) {
            collectAllBookmarks(children, currentPath);
          }
        });
      }
    });
  }

  // 搜索功能
  searchBox.addEventListener('input', () => {
    const searchTerm = searchBox.value.toLowerCase().trim();
    
    if (searchTerm === '') {
      // 清空搜索，恢复当前视图
      if (currentPath.length === 0) {
        // 恢复到根目录
        navigateToRoot();
      } else {
        // 恢复到当前文件夹
        const currentFolder = currentPath[currentPath.length - 1];
        navigateToFolder(currentFolder.id, currentFolder.title);
      }
      return;
    }
    
    // 更新标题
    folderTitle.textContent = `搜索: "${searchTerm}"`;
    
    // 使用Chrome的搜索API
    chrome.bookmarks.search(searchTerm, (results) => {
      bookmarkTree.innerHTML = '';
      
      if (results.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.innerHTML = `
          <span class="material-symbols-rounded no-results-icon">search_off</span>
          <span>没有找到匹配的书签</span>
        `;
        bookmarkTree.appendChild(noResults);
        return;
      }
      
      // 创建搜索结果容器
      const container = document.createElement('div');
      container.className = currentView === 'grid' ? 'bookmarks-grid' : 'bookmarks-list';
      
      // 只显示URL结果（书签而非文件夹）
      results.filter(result => result.url).forEach(result => {
        container.appendChild(currentView === 'grid' 
          ? createBookmarkGridItem(result) 
          : createBookmarkListItem(result));
      });
      
      bookmarkTree.appendChild(container);
    });
  });
}); 