// Study state management
let currentTrialIndex = 0;
let responses = [];
let startTime = null;
let trialStartTime = null;

// DOM elements
const welcomeScreen = document.getElementById('welcome-screen');
const studyScreen = document.getElementById('study-screen');
const completionScreen = document.getElementById('completion-screen');

const startButton = document.getElementById('start-button');
const selectAButton = document.getElementById('select-a');
const selectBButton = document.getElementById('select-b');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const downloadButton = document.getElementById('download-button');
const restartButton = document.getElementById('restart-button');

const questionText = document.getElementById('question-text');
const videoA = document.getElementById('video-a');
const videoB = document.getElementById('video-b');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// Initialize the study
function initStudy() {
    responses = new Array(studyTrials.length).fill(null);
    currentTrialIndex = 0;
    startTime = new Date().toISOString();
    
    startButton.addEventListener('click', startStudy);
    selectAButton.addEventListener('click', () => selectVideo('A'));
    selectBButton.addEventListener('click', () => selectVideo('B'));
    prevButton.addEventListener('click', previousTrial);
    nextButton.addEventListener('click', nextTrial);
    downloadButton.addEventListener('click', downloadResults);
    restartButton.addEventListener('click', restartStudy);
}

// Start the study
function startStudy() {
    welcomeScreen.classList.remove('active');
    studyScreen.classList.add('active');
    loadTrial(currentTrialIndex);
}

// Load a trial
function loadTrial(index) {
    if (index < 0 || index >= studyTrials.length) {
        return;
    }

    const trial = studyTrials[index];
    trialStartTime = new Date();
    
    // Update question
    questionText.textContent = trial.question;
    
    // Update videos
    videoA.src = trial.videoA;
    videoB.src = trial.videoB;
    
    // Reset video playback
    videoA.currentTime = 0;
    videoB.currentTime = 0;
    
    // Update progress
    updateProgress();
    
    // Update button states
    updateButtonStates();
    
    // Load previous response if exists
    if (responses[index]) {
        highlightSelection(responses[index].choice);
    } else {
        clearSelection();
    }
}

// Select a video
function selectVideo(choice) {
    const responseTime = new Date() - trialStartTime;
    
    responses[currentTrialIndex] = {
        trialIndex: currentTrialIndex,
        question: studyTrials[currentTrialIndex].question,
        videoA: studyTrials[currentTrialIndex].videoA,
        videoB: studyTrials[currentTrialIndex].videoB,
        choice: choice,
        responseTime: responseTime,
        timestamp: new Date().toISOString()
    };
    
    highlightSelection(choice);
    
    // Enable next button
    nextButton.disabled = false;
    
    // Auto-advance if not on last trial
    if (currentTrialIndex < studyTrials.length - 1) {
        setTimeout(() => {
            nextTrial();
        }, 500);
    } else {
        // Last trial - show completion after short delay
        setTimeout(() => {
            showCompletion();
        }, 500);
    }
}

// Highlight selected button
function highlightSelection(choice) {
    selectAButton.classList.remove('selected');
    selectBButton.classList.remove('selected');
    
    if (choice === 'A') {
        selectAButton.classList.add('selected');
    } else if (choice === 'B') {
        selectBButton.classList.add('selected');
    }
}

// Clear selection highlight
function clearSelection() {
    selectAButton.classList.remove('selected');
    selectBButton.classList.remove('selected');
}

// Update progress bar
function updateProgress() {
    const progress = ((currentTrialIndex + 1) / studyTrials.length) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Trial ${currentTrialIndex + 1} of ${studyTrials.length}`;
}

// Update button states
function updateButtonStates() {
    prevButton.disabled = currentTrialIndex === 0;
    nextButton.disabled = !responses[currentTrialIndex];
}

// Previous trial
function previousTrial() {
    if (currentTrialIndex > 0) {
        currentTrialIndex--;
        loadTrial(currentTrialIndex);
    }
}

// Next trial
function nextTrial() {
    if (currentTrialIndex < studyTrials.length - 1) {
        currentTrialIndex++;
        loadTrial(currentTrialIndex);
    }
}

// Show completion screen
function showCompletion() {
    studyScreen.classList.remove('active');
    completionScreen.classList.add('active');
}

// Download results as JSON
function downloadResults() {
    const results = {
        studyInfo: {
            startTime: startTime,
            endTime: new Date().toISOString(),
            totalTrials: studyTrials.length
        },
        responses: responses.filter(r => r !== null)
    };
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `2afc-study-results-${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Restart study
function restartStudy() {
    responses = new Array(studyTrials.length).fill(null);
    currentTrialIndex = 0;
    startTime = new Date().toISOString();
    
    completionScreen.classList.remove('active');
    welcomeScreen.classList.add('active');
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStudy);
} else {
    initStudy();
}
