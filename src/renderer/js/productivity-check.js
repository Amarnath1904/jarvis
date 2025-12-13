/**
 * Productivity Check Window Logic
 * Handles the productivity check flow and AI evaluation
 */

// DOM Elements
const initialQuestionsScreen = document.getElementById('initial-questions');
const journalQuestionsScreen = document.getElementById('journal-questions');
const aiFeedbackScreen = document.getElementById('ai-feedback');
const loadingScreen = document.getElementById('loading-screen');

const whyHappenedTextarea = document.getElementById('why-happened');
const howPreventTextarea = document.getElementById('how-prevent');
const submitJournalBtn = document.getElementById('submit-journal');
const rewriteBtn = document.getElementById('rewrite-btn');
const closeBtn = document.getElementById('close-btn');
const feedbackMessage = document.getElementById('feedback-message');
const feedbackSubtitle = document.getElementById('feedback-subtitle');
const retryInfo = document.getElementById('retry-info');

// State
let state = {
    workProperly: null,
    wastingTime: null,
    whyHappened: '',
    howPrevent: '',
    retryCount: 0,
    previousResponses: []
};

/**
 * Initialize productivity check window
 */
function init() {
    console.log('[ProductivityCheck] Initializing');
    
    // Setup initial question buttons
    document.querySelectorAll('[data-question]').forEach(btn => {
        btn.addEventListener('click', handleInitialQuestion);
    });

    // Setup submit button
    submitJournalBtn.addEventListener('click', handleSubmitJournal);

    // Setup rewrite button
    rewriteBtn.addEventListener('click', handleRewrite);

    // Setup close button
    closeBtn.addEventListener('click', handleClose);
}

/**
 * Handle initial question responses
 */
function handleInitialQuestion(e) {
    const question = e.target.dataset.question;
    const value = e.target.dataset.value === 'yes';

    // Visual feedback - highlight selected button
    const buttonGroup = e.target.closest('.button-group');
    buttonGroup.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('selected');
    });
    e.target.classList.add('selected');

    if (question === 'work-properly') {
        state.workProperly = value;
        console.log(`[ProductivityCheck] Work properly: ${value ? 'Yes' : 'No'}`);
    } else if (question === 'wasting-time') {
        state.wastingTime = value;
        console.log(`[ProductivityCheck] Wasting time: ${value ? 'Yes' : 'No'}`);
    }

    // Check if both questions are answered
    if (state.workProperly !== null && state.wastingTime !== null) {
        // Only show journal if: NOT working properly OR wasting time
        const needsReflection = state.workProperly === false || state.wastingTime === true;
        
        if (needsReflection) {
            // Need to show journal questions
            setTimeout(() => {
                showJournalQuestions();
            }, 500); // Small delay for visual feedback
        } else {
            // All good - show positive feedback and close
            setTimeout(() => {
                showPositiveFeedback();
            }, 500);
        }
    }
}

/**
 * Show positive feedback and close
 */
function showPositiveFeedback() {
    initialQuestionsScreen.classList.remove('active');
    aiFeedbackScreen.classList.add('active');
    
    feedbackMessage.textContent = 'Great job! You\'re working properly and not wasting time. Keep up the excellent work!';
    feedbackMessage.className = 'feedback-message success';
    feedbackSubtitle.textContent = 'All good!';
    retryInfo.textContent = '';
    closeBtn.style.display = 'block';
    rewriteBtn.style.display = 'none';
    
    // Auto-close after 3 seconds
    setTimeout(() => {
        handleClose();
    }, 3000);
}

/**
 * Show journal questions screen
 */
function showJournalQuestions() {
    initialQuestionsScreen.classList.remove('active');
    journalQuestionsScreen.classList.add('active');
    whyHappenedTextarea.focus();
}

/**
 * Handle journal submission
 */
async function handleSubmitJournal() {
    state.whyHappened = whyHappenedTextarea.value.trim();
    state.howPrevent = howPreventTextarea.value.trim();

    if (!state.whyHappened || !state.howPrevent) {
        alert('Please fill in both fields before submitting.');
        return;
    }

    // Show loading screen
    journalQuestionsScreen.classList.remove('active');
    loadingScreen.classList.add('active');

    try {
        // Send to AI for evaluation (retryCount is 0-indexed, so add 1 for display)
        const result = await window.electronAPI.evaluateProductivityJournal({
            workProperly: state.workProperly,
            wastingTime: state.wastingTime,
            whyHappened: state.whyHappened,
            howPrevent: state.howPrevent,
            retryCount: state.retryCount, // This is the current attempt (0 = first, 1 = second, etc.)
            previousResponses: state.previousResponses
        });

        showAIFeedback(result);
    } catch (error) {
        console.error('[ProductivityCheck] Error evaluating journal:', error);
        showAIFeedback({
            satisfied: true,
            message: 'Thank you for your response. Keep up the good work!',
            error: true
        });
    }
}

/**
 * Show AI feedback screen
 */
function showAIFeedback(result) {
    loadingScreen.classList.remove('active');
    aiFeedbackScreen.classList.add('active');

    if (result.error) {
        feedbackMessage.textContent = result.message;
        feedbackMessage.className = 'feedback-message warning';
        closeBtn.style.display = 'block';
        rewriteBtn.style.display = 'none';
        return;
    }

    feedbackMessage.textContent = result.message;
    
    if (result.satisfied) {
        feedbackMessage.className = 'feedback-message success';
        feedbackSubtitle.textContent = 'Your response has been accepted';
        closeBtn.style.display = 'block';
        rewriteBtn.style.display = 'none';
    } else {
        feedbackMessage.className = 'feedback-message warning';
        feedbackSubtitle.textContent = 'Please revise your response';
        
        // Show retry info
        const currentAttempt = state.retryCount + 1;
        if (currentAttempt < 5) {
            retryInfo.textContent = `Attempt ${currentAttempt} of 5`;
            rewriteBtn.style.display = 'block';
            closeBtn.style.display = 'none';
        } else {
            retryInfo.textContent = 'Maximum retry limit reached. Your response has been recorded.';
            rewriteBtn.style.display = 'none';
            closeBtn.style.display = 'block';
        }
    }
}

/**
 * Handle rewrite button
 */
function handleRewrite() {
    if (state.retryCount >= 5) {
        handleClose();
        return;
    }

    // Store previous response
    state.previousResponses.push({
        whyHappened: state.whyHappened,
        howPrevent: state.howPrevent,
        retryCount: state.retryCount
    });

    state.retryCount++;
    
    // Clear textareas and go back to journal screen
    whyHappenedTextarea.value = '';
    howPreventTextarea.value = '';
    
    aiFeedbackScreen.classList.remove('active');
    journalQuestionsScreen.classList.add('active');
    whyHappenedTextarea.focus();
}

/**
 * Handle close button
 */
function handleClose() {
    if (window.electronAPI && window.electronAPI.closeProductivityCheck) {
        window.electronAPI.closeProductivityCheck();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

