// ========================================
// GitHub API Integration for Latest Release
// ========================================

const GITHUB_REPO = 'jinyang6/chatanyllm';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_ALL_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

// DOM Elements
const downloadCard = document.getElementById('download-card');
const downloadLoading = document.getElementById('download-loading');
const downloadContent = document.getElementById('download-content');
const downloadError = document.getElementById('download-error');
const versionBadge = document.getElementById('version-badge');
const versionText = document.getElementById('version-text');
const releaseDate = document.getElementById('release-date');
const downloadButton = document.getElementById('download-button');
const releaseNotesLink = document.getElementById('release-notes-link');
const downloadStats = document.getElementById('download-stats');

// Fetch total downloads across all releases
async function fetchTotalDownloads() {
  try {
    const response = await fetch(GITHUB_ALL_RELEASES_URL);

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const releases = await response.json();

    // Sum downloads across all releases
    let totalDownloads = 0;
    releases.forEach(release => {
      release.assets.forEach(asset => {
        totalDownloads += asset.download_count;
      });
    });

    return totalDownloads;
  } catch (error) {
    console.error('Error fetching total downloads:', error);
    return 0;
  }
}

// Fetch latest release from GitHub API
async function fetchLatestRelease() {
  try {
    // Fetch both latest release and total downloads in parallel
    const [releaseResponse, totalDownloads] = await Promise.all([
      fetch(GITHUB_API_URL),
      fetchTotalDownloads()
    ]);

    if (!releaseResponse.ok) {
      throw new Error(`GitHub API error: ${releaseResponse.status}`);
    }

    const data = await releaseResponse.json();

    // Find the Windows installer (.exe) asset
    const exeAsset = data.assets.find(asset =>
      asset.name.endsWith('.exe') && asset.name.includes('Setup')
    );

    if (!exeAsset) {
      throw new Error('No Windows installer found in latest release');
    }

    // Update the download section with release info
    updateDownloadSection({
      version: data.tag_name,
      downloadUrl: exeAsset.browser_download_url,
      downloadCount: totalDownloads,
      releaseUrl: data.html_url,
      publishedAt: new Date(data.published_at),
      assetName: exeAsset.name
    });

  } catch (error) {
    console.error('Error fetching latest release:', error);
    showError();
  }
}

// Update the download section with release data
function updateDownloadSection(release) {
  // Hide loading, show content
  downloadLoading.style.display = 'none';
  downloadContent.style.display = 'flex';

  // Update version badge
  versionText.textContent = `Latest: ${release.version}`;

  // Format date
  const formattedDate = release.publishedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  releaseDate.textContent = formattedDate;

  // Update download button
  downloadButton.href = release.downloadUrl;
  downloadButton.textContent = '';

  // Add icon
  const downloadIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  downloadIcon.setAttribute('width', '20');
  downloadIcon.setAttribute('height', '20');
  downloadIcon.setAttribute('viewBox', '0 0 24 24');
  downloadIcon.setAttribute('fill', 'none');
  downloadIcon.setAttribute('stroke', 'currentColor');
  downloadIcon.setAttribute('stroke-width', '2');
  downloadIcon.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>';

  downloadButton.appendChild(downloadIcon);
  downloadButton.appendChild(document.createTextNode(`Download ${release.assetName}`));

  // Update release notes link
  releaseNotesLink.href = release.releaseUrl;
  releaseNotesLink.target = '_blank';
  releaseNotesLink.rel = 'noopener noreferrer';

  // Show download count if available
  if (release.downloadCount > 0) {
    downloadStats.textContent = `Downloaded ${release.downloadCount.toLocaleString()} times`;
    downloadStats.style.display = 'block';
  }
}

// Show error state
function showError() {
  downloadLoading.style.display = 'none';
  downloadError.style.display = 'flex';
}

// ========================================
// Smooth Scroll for Anchor Links
// ========================================

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');

      // Skip if href is just "#" or empty
      if (!href || href === '#') {
        e.preventDefault();
        return;
      }

      const targetElement = document.querySelector(href);

      if (targetElement) {
        e.preventDefault();

        // Get the target position, accounting for sticky nav
        const navHeight = document.querySelector('.nav').offsetHeight;
        const targetPosition = targetElement.offsetTop - navHeight - 20;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ========================================
// Initialize on Page Load
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // Fetch latest release from GitHub
  fetchLatestRelease();

  // Initialize smooth scroll
  initSmoothScroll();

  // Add scroll event for nav shadow
  let lastScroll = 0;
  const nav = document.querySelector('.nav');

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 10) {
      nav.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
    } else {
      nav.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
  });
});
