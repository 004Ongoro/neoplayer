const { ipcRenderer } = require('electron');

// DOM Elements
const videoPlayer = document.getElementById('videoPlayer');
const audioPlayer = document.getElementById('audioPlayer');
const playlist = document.getElementById('playlist');
const currentFileName = document.getElementById('currentFileName');
const fileInfo = document.getElementById('fileInfo');
const placeholder = document.getElementById('placeholder');
const customControls = document.getElementById('customControls');

// Buttons
const openFileBtn = document.getElementById('openFileBtn');
const openFolderBtn = document.getElementById('openFolderBtn');
const openFilePlaceholderBtn = document.getElementById('openFilePlaceholderBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseMainBtn = document.getElementById('playPauseMainBtn');
const stopBtn = document.getElementById('stopBtn');
const stopMainBtn = document.getElementById('stopMainBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const rewindBtn = document.getElementById('rewindBtn');
const forwardBtn = document.getElementById('forwardBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const volumeSlider = document.getElementById('volume');
const playbackRateSelect = document.getElementById('playbackRate');

// Progress elements
const progressBar = document.getElementById('progressBar');
const progress = document.getElementById('progress');
const currentTimeDisplay = document.getElementById('currentTime');
const durationDisplay = document.getElementById('duration');

// State
let currentPlayer = null;
let currentMediaIndex = -1;
let mediaFiles = [];
let isPlaying = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    hideNativeControls();
});

function setupEventListeners() {
    // Button event listeners
    openFileBtn.addEventListener('click', () => ipcRenderer.send('open-file-dialog'));
    openFolderBtn.addEventListener('click', () => ipcRenderer.send('open-folder-dialog'));
    openFilePlaceholderBtn.addEventListener('click', () => ipcRenderer.send('open-file-dialog'));
    
    // Player control buttons
    playPauseBtn.addEventListener('click', togglePlayPause);
    playPauseMainBtn.addEventListener('click', togglePlayPause);
    stopBtn.addEventListener('click', stopPlayback);
    stopMainBtn.addEventListener('click', stopPlayback);
    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrevious);
    rewindBtn.addEventListener('click', () => seek(-10));
    forwardBtn.addEventListener('click', () => seek(10));
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Progress bar
    progressBar.addEventListener('click', handleProgressBarClick);
    
    // Volume control
    volumeSlider.addEventListener('input', updateVolume);
    
    // Playback rate
    playbackRateSelect.addEventListener('change', updatePlaybackRate);
    
    // Player events
    videoPlayer.addEventListener('loadedmetadata', updateMediaInfo);
    audioPlayer.addEventListener('loadedmetadata', updateMediaInfo);
    videoPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    videoPlayer.addEventListener('ended', playNext);
    audioPlayer.addEventListener('ended', playNext);
    videoPlayer.addEventListener('play', () => updatePlayState(true));
    videoPlayer.addEventListener('pause', () => updatePlayState(false));
    audioPlayer.addEventListener('play', () => updatePlayState(true));
    audioPlayer.addEventListener('pause', () => updatePlayState(false));
    
    // IPC listeners
    ipcRenderer.on('file-opened', (event, filePath) => {
        loadMediaFile(filePath);
    });
    
    ipcRenderer.on('folder-opened', async (event, folderPath) => {
        await loadMediaFolder(folderPath);
    });
    
    ipcRenderer.on('player-control', (event, command) => {
        handlePlayerCommand(command);
    });
}

function hideNativeControls() {
    videoPlayer.controls = false;
    audioPlayer.controls = false;
}

function loadMediaFile(filePath) {
    const fileExt = filePath.toLowerCase().split('.').pop();
    const isVideo = ['mp4', 'avi', 'mkv', 'mov', 'webm'].includes(fileExt);
    const isAudio = ['mp3', 'wav', 'flac', 'm4a', 'ogg'].includes(fileExt);
    
    if (!isVideo && !isAudio) {
        alert('Unsupported file format');
        return;
    }
    
    // Hide placeholder, show custom controls
    placeholder.style.display = 'none';
    customControls.style.display = 'flex';
    
    // Set up the appropriate player
    if (isVideo) {
        videoPlayer.style.display = 'block';
        audioPlayer.style.display = 'none';
        currentPlayer = videoPlayer;
    } else {
        videoPlayer.style.display = 'none';
        audioPlayer.style.display = 'block';
        currentPlayer = audioPlayer;
    }
    
    // Load and play the file
    currentPlayer.src = filePath;
    currentPlayer.load();
    
    // Update UI
    const fileName = filePath.split('/').pop().split('\\').pop();
    currentFileName.textContent = fileName;
    
    // Add to playlist if not already there
    if (!mediaFiles.some(file => file.path === filePath)) {
        mediaFiles.push({
            name: fileName,
            path: filePath,
            type: isVideo ? 'video' : 'audio'
        });
        currentMediaIndex = mediaFiles.length - 1;
        updatePlaylist();
    } else {
        currentMediaIndex = mediaFiles.findIndex(file => file.path === filePath);
    }
    
    // Highlight current item in playlist
    highlightCurrentPlaylistItem();
}

async function loadMediaFolder(folderPath) {
    try {
        mediaFiles = await ipcRenderer.invoke('read-directory', folderPath);
        currentMediaIndex = -1;
        updatePlaylist();
        
        if (mediaFiles.length > 0) {
            // Auto-play first file
            currentMediaIndex = 0;
            loadMediaFile(mediaFiles[0].path);
        }
    } catch (error) {
        console.error('Error loading folder:', error);
        alert('Error loading folder: ' + error.message);
    }
}

function updatePlaylist() {
    playlist.innerHTML = '';
    
    mediaFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'playlist-item';
        if (index === currentMediaIndex) {
            li.classList.add('active');
        }
        
        li.innerHTML = `
            <i class="fas fa-${file.type === 'video' ? 'video' : 'music'}"></i>
            <span>${file.name}</span>
        `;
        
        li.addEventListener('click', () => {
            currentMediaIndex = index;
            loadMediaFile(file.path);
        });
        
        playlist.appendChild(li);
    });
}

function highlightCurrentPlaylistItem() {
    const items = playlist.querySelectorAll('.playlist-item');
    items.forEach((item, index) => {
        if (index === currentMediaIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function togglePlayPause() {
    if (!currentPlayer) return;
    
    if (currentPlayer.paused) {
        currentPlayer.play();
    } else {
        currentPlayer.pause();
    }
}

function stopPlayback() {
    if (!currentPlayer) return;
    
    currentPlayer.pause();
    currentPlayer.currentTime = 0;
    updatePlayState(false);
}

function playNext() {
    if (mediaFiles.length === 0) return;
    
    currentMediaIndex = (currentMediaIndex + 1) % mediaFiles.length;
    loadMediaFile(mediaFiles[currentMediaIndex].path);
}

function playPrevious() {
    if (mediaFiles.length === 0) return;
    
    currentMediaIndex = currentMediaIndex <= 0 ? mediaFiles.length - 1 : currentMediaIndex - 1;
    loadMediaFile(mediaFiles[currentMediaIndex].path);
}

function seek(seconds) {
    if (!currentPlayer) return;
    
    currentPlayer.currentTime += seconds;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function updateVolume() {
    if (!currentPlayer) return;
    
    const volume = volumeSlider.value / 100;
    currentPlayer.volume = volume;
}

function updatePlaybackRate() {
    if (!currentPlayer) return;
    
    currentPlayer.playbackRate = parseFloat(playbackRateSelect.value);
}

function updateMediaInfo() {
    if (!currentPlayer) return;
    
    const duration = formatTime(currentPlayer.duration);
    durationDisplay.textContent = isNaN(currentPlayer.duration) ? '00:00' : duration;
    
    // Update file info
    fileInfo.innerHTML = `
        <p><strong>File:</strong> ${currentPlayer.src.split('/').pop().split('\\').pop()}</p>
        <p><strong>Duration:</strong> ${duration}</p>
        <p><strong>Type:</strong> ${currentPlayer.tagName === 'VIDEO' ? 'Video' : 'Audio'}</p>
        <p><strong>Size:</strong> ${formatFileSize(0)}</p>
    `;
}

function updateProgress() {
    if (!currentPlayer) return;
    
    const currentTime = currentPlayer.currentTime;
    const duration = currentPlayer.duration;
    
    if (!isNaN(duration)) {
        const progressPercent = (currentTime / duration) * 100;
        progress.style.width = `${progressPercent}%`;
        
        currentTimeDisplay.textContent = formatTime(currentTime);
        durationDisplay.textContent = formatTime(duration);
    }
}

function updatePlayState(playing) {
    isPlaying = playing;
    const playIcon = playing ? 'fa-pause' : 'fa-play';
    
    // Update button icons
    document.querySelectorAll('#playPauseBtn i, #playPauseMainBtn i').forEach(icon => {
        icon.className = `fas ${playIcon}`;
    });
}

function handleProgressBarClick(e) {
    if (!currentPlayer) return;
    
    const progressBarRect = progressBar.getBoundingClientRect();
    const clickPosition = e.clientX - progressBarRect.left;
    const progressBarWidth = progressBarRect.width;
    const percentage = clickPosition / progressBarWidth;
    
    currentPlayer.currentTime = percentage * currentPlayer.duration;
}

function handlePlayerCommand(command) {
    switch (command) {
        case 'toggle-play':
        case 'play':
        case 'pause':
            togglePlayPause();
            break;
        case 'next':
            playNext();
            break;
        case 'previous':
            playPrevious();
            break;
        case 'forward-10':
            seek(10);
            break;
        case 'backward-10':
            seek(-10);
            break;
        case 'volume-up':
            volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 10);
            updateVolume();
            break;
        case 'volume-down':
            volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 10);
            updateVolume();
            break;
    }
}

// Utility functions
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return 'Unknown';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Prevent default behavior for media keys
    if ([32, 37, 39, 38, 40].includes(e.keyCode)) {
        e.preventDefault();
    }
    
    switch (e.key) {
        case ' ':
        case 'Spacebar':
            togglePlayPause();
            break;
        case 'ArrowLeft':
            if (e.ctrlKey) {
                playPrevious();
            } else {
                seek(-10);
            }
            break;
        case 'ArrowRight':
            if (e.ctrlKey) {
                playNext();
            } else {
                seek(10);
            }
            break;
        case 'ArrowUp':
            volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 10);
            updateVolume();
            break;
        case 'ArrowDown':
            volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 10);
            updateVolume();
            break;
        case 'f':
        case 'F':
            if (e.ctrlKey || e.metaKey) {
                toggleFullscreen();
            }
            break;
    }
});

// Handle drag and drop
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const filePath = files[0].path;
        loadMediaFile(filePath);
    }
});