(() => {
  const params = new URLSearchParams(window.location.search);
  const initialQuestionSet = params.get('questionSet') || null;
  const PACK_MANIFEST_URL = 'data/packs/manifest.json';
  const STORAGE_KEY = 'userStudy.sessions';
  const AUTOSAVE_DELAY_MS = 800;
  const config = {
    submissionMode:
      params.get('submissionMode') ||
      (params.has('assignmentId') ? 'mturk' : 'local'),
    responseEndpoint: params.get('responseEndpoint') || null,
  };

  const elements = {
    axisLabel: document.getElementById('axisLabel'),
    progress: document.getElementById('progressLabel'),
    prompt: document.getElementById('questionPrompt'),
    contextBlock: document.getElementById('contextBlock'),
    contextImage: document.getElementById('contextImage'),
    contextCaption: document.getElementById('contextCaption'),
    videoGrid: document.getElementById('videoGrid'),
    helper: document.getElementById('helperText'),
    backButton: document.getElementById('backButton'),
    nextButton: document.getElementById('nextButton'),
    skipButton: document.getElementById('skipButton'),
    submissionPanel: document.getElementById('submissionPanel'),
    submitButton: document.getElementById('submitButton'),
    responsesInput: document.getElementById('responses'),
    assignmentInput: document.getElementById('assignmentId'),
    workerInput: document.getElementById('workerId'),
    hitInput: document.getElementById('hitId'),
    form: document.getElementById('mturkForm'),
    previewStatus: document.getElementById('previewStatus'),
    participantPanel: document.getElementById('participantPanel'),
    participantForm: document.getElementById('participantForm'),
    participantName: document.getElementById('participantName'),
    participantHint: document.getElementById('participantHint'),
    localPanel: document.getElementById('localSubmissionPanel'),
    downloadButton: document.getElementById('downloadButton'),
    sendButton: document.getElementById('sendButton'),
    submissionStatus: document.getElementById('submissionStatus'),
  };

  const state = {
    questions: [],
    index: 0,
    responses: [],
    submissionMode: config.submissionMode,
    isPreview: false,
    questionSet: initialQuestionSet || null,
    loadedQuestionSet: null,
    packManifest: [],
    sessionKey: null,
    autosaveTimer: null,
    remoteSaveController: null,
    isNavigating: false,
    participant: {
      name: '',
    },
  };

  let cachedSessions = null;
  let manifestPromise = null;
  let activeLoadToken = 0;
  let lastResolvedNameKey = '';

  manifestPromise = initialQuestionSet
    ? Promise.resolve([])
    : loadPackManifest();

  function configureSubmissionMode() {
    if (state.submissionMode === 'mturk') {
      const assignmentId = params.get('assignmentId') || '';
      const workerId = params.get('workerId') || '';
      const hitId = params.get('hitId') || '';
      const submitHost = params.get('turkSubmitTo');

      elements.assignmentInput.value = assignmentId;
      elements.workerInput.value = workerId;
      elements.hitInput.value = hitId;

      if (submitHost) {
        elements.form.action = `${submitHost}/mturk/externalSubmit`;
      }

      state.isPreview = assignmentId === 'ASSIGNMENT_ID_NOT_AVAILABLE';
      elements.previewStatus.hidden = !state.isPreview;
    } else {
      state.isPreview = false;
      elements.previewStatus.hidden = true;
      if (elements.submissionPanel) {
        elements.submissionPanel.hidden = true;
      }
    }

    if (elements.localPanel) {
      elements.localPanel.hidden = true;
      if (elements.sendButton) {
        elements.sendButton.hidden = !config.responseEndpoint;
      }
    }
  }

  function skipCurrentQuestion() {
    const question = state.questions[state.index];
    if (!question || !elements.skipButton || elements.skipButton.disabled) {
      return;
    }
    const response = createResponsePayload(question, {
      choice: null,
      skipped: true,
      skipReason: 'user',
    });
    if (!response) {
      return;
    }
    state.responses[state.index] = response;
    scheduleAutosave();
    const onLastQuestion = state.index >= state.questions.length - 1;
    if (onLastQuestion) {
      updateNavState();
      return;
    }
    renderQuestion(state.index + 1);
  }

  function alignResponses(total) {
    const next = new Array(total).fill(null);
    (state.responses || []).forEach((response, index) => {
      if (index < total && response) {
        next[index] = response;
      }
    });
    state.responses = next;
  }

  function determineResumeIndex() {
    if (Number.isInteger(state.index) && state.index >= 0) {
      return Math.min(state.index, Math.max(state.questions.length - 1, 0));
    }
    const firstUnanswered = state.responses.findIndex((response) => !response);
    if (firstUnanswered >= 0) {
      return firstUnanswered;
    }
    return Math.max(state.questions.length - 1, 0);
  }

  async function loadPackManifest() {
    try {
      const response = await fetch(PACK_MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unable to load ${PACK_MANIFEST_URL}`);
      }
      const payload = await response.json();
      const packs = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.packs)
          ? payload.packs
          : [];
      state.packManifest = packs.filter((item) => typeof item === 'string');
    } catch (error) {
      console.warn('Falling back to sample questions. Pack manifest missing.', error);
      state.packManifest = [];
    }
    return state.packManifest;
  }

  async function loadQuestions(setOverride) {
    const targetSet =
      setOverride || state.questionSet || initialQuestionSet || 'questions_sample';
    state.questionSet = targetSet;
    const datasetUrl = `data/${targetSet}.json`;
    const requestToken = ++activeLoadToken;

    try {
      const response = await fetch(datasetUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unable to load ${datasetUrl}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload) || payload.length === 0) {
        throw new Error('Question file is empty.');
      }
      if (requestToken !== activeLoadToken) {
        return;
      }
      state.questions = payload;
      state.loadedQuestionSet = targetSet;
      alignResponses(payload.length);
      const startIndex = determineResumeIndex();
      renderQuestion(startIndex);
      elements.helper.textContent = 'Make a selection to continue.';
      persistSession();
    } catch (error) {
      console.error(error);
      elements.helper.textContent =
        'Could not load the question list. Confirm the file exists in /data.';
      elements.nextButton.disabled = true;
    }
  }

  function cleanupAllVideos() {
    // Properly cleanup all video elements before removing them from DOM
    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load(); // This aborts any pending network requests
      } catch (error) {
        console.warn('Error cleaning up video:', error);
      }
    });
  }

  function renderQuestion(index) {
    // Prevent rendering if already navigating
    if (state.isNavigating) {
      return;
    }

    state.isNavigating = true;

    // Clean up all existing videos before rendering new question
    cleanupAllVideos();

    state.index = index;
    const question = state.questions[index];
    if (!question) {
      state.isNavigating = false;
      return;
    }

    const axisPieces = [
      question.axis || 'Axis',
      question.axisDetail || null,
    ].filter(Boolean);
    elements.axisLabel.textContent = axisPieces.join(' — ') || 'Axis';
    elements.progress.textContent = `Question ${index + 1} of ${
      state.questions.length
    }`;
    elements.prompt.textContent = question.prompt || 'Question text missing.';

    toggleContext(question);
    const previousChoice = state.responses[index]?.choice || null;
    renderOptions(question, previousChoice);
    updateNavState();
    persistSession();

    // Allow navigation again after a short delay to prevent rapid clicks
    setTimeout(() => {
      state.isNavigating = false;
    }, 300);
  }

  function toggleContext(question) {
    const { contextImage, contextCaption } = question;
    const hasContext = Boolean(contextImage);
    elements.contextBlock.hidden = !hasContext;

    if (hasContext) {
      // Clear previous image first to avoid flashing old content
      const oldSrc = elements.contextImage.src;
      if (oldSrc && oldSrc !== contextImage) {
        elements.contextImage.removeAttribute('src');
      }

      // Add loading state
      elements.contextImage.classList.add('image-loading');

      // Set up error handling
      const handleError = () => {
        console.error('Context image failed to load:', contextImage);
        elements.contextImage.classList.remove('image-loading');
        elements.contextCaption.textContent = 'Reference image failed to load';
        elements.contextCaption.style.color = '#d32f2f';
      };

      const handleLoad = () => {
        elements.contextImage.classList.remove('image-loading');
        elements.contextCaption.style.color = '';
      };

      // Remove old listeners and add new ones
      elements.contextImage.removeEventListener('error', handleError);
      elements.contextImage.removeEventListener('load', handleLoad);
      elements.contextImage.addEventListener('error', handleError, { once: true });
      elements.contextImage.addEventListener('load', handleLoad, { once: true });

      elements.contextImage.src = contextImage;
      elements.contextImage.alt =
        question.contextAlt || 'Reference diagram for this trial';
      elements.contextCaption.textContent =
        contextCaption || 'Reference image for the applied forces.';
    } else {
      elements.contextImage.removeAttribute('src');
      elements.contextImage.alt = '';
      elements.contextCaption.textContent = '';
      elements.contextImage.classList.remove('image-loading');
      elements.contextCaption.style.color = '';
    }
  }

  function renderOptions(question, selectedChoice) {
    if (!elements.videoGrid) {
      return;
    }
    elements.videoGrid.innerHTML = '';
    const options = deriveOptions(question);
    options.forEach((option) => {
      const card = document.createElement('article');
      card.className = 'video-option';
      card.dataset.choice = option.value;

      const header = document.createElement('div');
      header.className = 'option-header';
      const label = document.createElement('p');
      label.className = 'option-label';
      label.textContent = `Option ${option.value}`;
      header.appendChild(label);
    card.appendChild(header);

      if (option.clips.length > 0) {
        const stack = document.createElement('div');
        stack.className = 'clip-stack';
        option.clips.forEach((clip) => {
          const block = document.createElement('div');
          block.className = 'clip-block';
          if (clip.label) {
            const clipLabel = document.createElement('p');
            clipLabel.className = 'clip-label';
            clipLabel.textContent = clip.label;
            block.appendChild(clipLabel);
          }
          const videoEl = document.createElement('video');
          configureMedia(videoEl, clip);
          block.appendChild(videoEl);
          stack.appendChild(block);
        });
        card.appendChild(stack);
      }

      const control = document.createElement('label');
      control.className = 'choice-control';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'choice';
      input.value = option.value;
      input.checked = option.value === selectedChoice;
      control.appendChild(input);
      const span = document.createElement('span');
      span.textContent = `Select ${option.value}`;
      control.appendChild(span);
      card.appendChild(control);

      elements.videoGrid.appendChild(card);
    });

    getChoiceInputs().forEach((input) => {
      input.addEventListener('change', handleChoice);
    });
    highlightChoice(selectedChoice);
  }

  function deriveOptions(question) {
    if (question.optionA && question.optionB) {
      return [
        normalizeOption('A', question.optionA),
        normalizeOption('B', question.optionB),
      ];
    }
    const defaults = [];
    if (question.videoA) {
      defaults.push(
        normalizeOption('A', {
          label: question.videoA.label || 'Video A',
          clips: [question.videoA],
        })
      );
    }
    if (question.videoB) {
      defaults.push(
        normalizeOption('B', {
          label: question.videoB.label || 'Video B',
          clips: [question.videoB],
        })
      );
    }
    return defaults;
  }

  function normalizeOption(choiceValue, optionData = {}) {
    const title = `Option ${choiceValue}`;
    const clips = (optionData.clips || []).map((clip, index) => {
      const label =
        clip.label ||
        clip.title ||
        (clip.level
          ? `${clip.level.toUpperCase()}`
          : `Clip ${String.fromCharCode(65 + index)}`);
      return {
        ...clip,
        label,
      };
    });

    return {
      value: choiceValue,
      title,
      subtitle: null,
      clips,
    };
  }

  function configureMedia(videoEl, meta = {}) {
    const { src, poster, label } = meta || {};
    videoEl.pause();
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.autoplay = true;
    videoEl.playsInline = true;

    if (src) {
      videoEl.src = src;
    } else {
      videoEl.removeAttribute('src');
      return;
    }

    if (poster) {
      videoEl.poster = poster;
    } else {
      videoEl.removeAttribute('poster');
    }

    // Add error handling for video loading
    videoEl.addEventListener('error', (e) => {
      console.error('Video loading error:', src, e);
      const parent = videoEl.parentElement;
      if (parent) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'video-error';
        errorMsg.textContent = 'Video failed to load';
        errorMsg.style.cssText = 'color: #d32f2f; padding: 10px; text-align: center; background: #ffebee; border-radius: 4px;';
        parent.appendChild(errorMsg);
      }
    }, { once: true });

    // Add loading indicator
    videoEl.classList.add('video-loading');

    // Remove loading state once video can play
    videoEl.addEventListener('canplay', () => {
      videoEl.classList.remove('video-loading');
    }, { once: true });

    videoEl.load();
    autoPlayVideo(videoEl);
  }

  function handleChoice(event) {
    const choice = event.target.value;
    recordResponse(choice);
    highlightChoice(choice);
    updateNavState();
  }

  function createResponsePayload(question, extra = {}) {
    if (!question) {
      return null;
    }
    const payload = {
      questionId: question.id || `question_${state.index + 1}`,
      fieldId: question.fieldId || question.field?.id || null,
      fieldLabel: question.fieldLabel || question.field?.label || null,
      dataset: question.dataset || null,
      axis: question.axis || null,
      axisDetail: question.axisDetail || null,
      prompt: question.prompt || '',
      targetLevel: question.targetLevel || question.meta?.targetLevel || null,
      meta: clone(question.meta),
      videoA: clone(question.videoA),
      videoB: clone(question.videoB),
      optionA: clone(question.optionA),
      optionB: clone(question.optionB),
      timestamp: new Date().toISOString(),
      ...extra,
    };
    if (question.field) {
      payload.field = clone(question.field);
    }
    return payload;
  }

  function recordResponse(choice) {
    const question = state.questions[state.index];
    const response = createResponsePayload(question, { choice });
    if (!response) {
      return;
    }
    state.responses[state.index] = response;
    scheduleAutosave();
  }

  function highlightChoice(choice) {
    document.querySelectorAll('.video-option').forEach((card) => {
      card.dataset.selected = card.dataset.choice === choice ? 'true' : 'false';
    });
  }

  function updateNavState() {
    const blockingReason = getBlockingReason();
    if (blockingReason) {
      setControlsLocked(true);
      elements.helper.textContent = blockingReason;
      return;
    }

    setControlsLocked(false);

    const total = state.questions.length;
    const answeredCurrent = Boolean(state.responses[state.index]);
    const onLastQuestion = state.index === total - 1;
    elements.backButton.disabled = state.index === 0;
    elements.nextButton.disabled = !answeredCurrent || onLastQuestion;
    if (elements.skipButton) {
      elements.skipButton.disabled = answeredCurrent || total === 0;
    }
    elements.nextButton.textContent = onLastQuestion
      ? 'All Saved'
      : 'Save & Next';
    elements.helper.textContent = answeredCurrent
      ? 'You can adjust your choice or continue.'
      : 'Select A or B to continue.';

    if (allQuestionsAnswered()) {
      prepareSubmission();
    } else {
      if (elements.submissionPanel) {
        elements.submissionPanel.hidden = true;
        elements.submitButton.disabled = true;
      }
      if (elements.localPanel) {
        elements.localPanel.hidden = true;
      }
    }
  }

  function allQuestionsAnswered() {
    return (
      state.questions.length > 0 &&
      state.responses.filter(Boolean).length === state.questions.length
    );
  }

  function prepareSubmission() {
    if (state.submissionMode === 'mturk') {
      elements.submissionPanel.hidden = false;
      elements.responsesInput.value = JSON.stringify(state.responses);
      elements.submitButton.disabled = false;
      elements.helper.textContent =
        'All questions answered. Review below and submit when ready.';
      return;
    }

    if (elements.localPanel) {
      elements.localPanel.hidden = false;
      if (elements.downloadButton) {
        elements.downloadButton.disabled = false;
      }
      if (elements.sendButton) {
        elements.sendButton.hidden = !config.responseEndpoint;
        elements.sendButton.disabled = !config.responseEndpoint;
      }
      elements.helper.textContent =
        'All questions answered. Save or send your responses below.';
    }
  }

  function goNext() {
    if (state.index >= state.questions.length - 1 || state.isNavigating) {
      return;
    }
    renderQuestion(state.index + 1);
  }

  function goBack() {
    if (state.index === 0 || state.isNavigating) {
      return;
    }
    renderQuestion(state.index - 1);
  }

  function bindEvents() {
    elements.nextButton.addEventListener('click', goNext);
    elements.backButton.addEventListener('click', goBack);
    if (elements.skipButton) {
      elements.skipButton.addEventListener('click', skipCurrentQuestion);
    }
    if (elements.participantForm) {
      elements.participantForm.addEventListener('input', handleParticipantInput);
    }
    if (elements.downloadButton) {
      elements.downloadButton.addEventListener('click', downloadResponses);
    }
    if (elements.sendButton) {
      elements.sendButton.addEventListener('click', sendResponses);
    }
    window.addEventListener('beforeunload', persistSession);
  }

  function autoPlayVideo(videoEl) {
    const playHandler = () => {
      videoEl.currentTime = 0;
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    };

    if (videoEl.readyState >= 2) {
      playHandler();
    } else {
      videoEl.addEventListener(
        'loadeddata',
        () => {
          playHandler();
        },
        { once: true }
      );
    }
  }

  function handleParticipantInput() {
    if (!elements.participantForm) {
      return;
    }
    const name = elements.participantName?.value?.trim() || '';
    state.participant.name = name;
    updateParticipantHint();
    updateNavState();
    const nameKey = getNameKey(name);
    if (!nameKey) {
      state.sessionKey = null;
      lastResolvedNameKey = '';
      return;
    }
    if (nameKey === lastResolvedNameKey) {
      return;
    }
    lastResolvedNameKey = nameKey;
    resetProgressForNewParticipant();
    state.sessionKey = nameKey;
    if (!manifestPromise) {
      manifestPromise = initialQuestionSet
        ? Promise.resolve([])
        : loadPackManifest();
    }
    manifestPromise
      .catch(() => [])
      .finally(() => {
        resumeOrAssignSession(nameKey);
      });
  }

  function resumeOrAssignSession(nameKey) {
    const stored = getSessionRecord(nameKey);
    if (stored) {
      applyStoredSession(stored);
      return;
    }
    if (state.questionSet && initialQuestionSet) {
      elements.helper.textContent = 'Loading your question set…';
      loadQuestions(state.questionSet);
      return;
    }
    const assignedSet = pickPackForName(nameKey);
    state.questionSet = assignedSet;
    elements.helper.textContent = 'Loading your question set…';
    loadQuestions(assignedSet);
  }

  function applyStoredSession(record) {
    state.questionSet =
      record.questionSet || state.questionSet || initialQuestionSet || null;
    state.responses = (record.responses || []).map((entry) => entry || null);
    state.index = record.index || 0;
    if (record.participant?.name && elements.participantName) {
      elements.participantName.value = record.participant.name;
      state.participant.name = record.participant.name;
    }
    updateParticipantHint();
    if (state.loadedQuestionSet === state.questionSet && state.questions.length) {
      renderQuestion(determineResumeIndex());
    } else if (state.questionSet) {
      loadQuestions(state.questionSet);
    }
  }

  function pickPackForName(nameKey) {
    if (state.packManifest.length === 0) {
      return 'questions_sample';
    }
    const hash = hashString(nameKey);
    const index = Math.abs(hash) % state.packManifest.length;
    return state.packManifest[index];
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function resetProgressForNewParticipant() {
    state.questions = [];
    state.responses = [];
    state.index = 0;
    state.loadedQuestionSet = null;
    state.questionSet = initialQuestionSet || null;
  }

  function updateParticipantHint() {
    if (!elements.participantHint) {
      return;
    }
    if (isParticipantValid()) {
      elements.participantHint.textContent = `Thanks, ${
        state.participant.name
      }!`;
    } else {
      elements.participantHint.textContent =
        'Please tell us who you are so we can credit your responses.';
    }
  }

  function isParticipantValid() {
    if (state.submissionMode === 'mturk') {
      return true;
    }
    return Boolean(state.participant.name?.trim());
  }

  function getBlockingReason() {
    if (state.submissionMode === 'mturk' && state.isPreview) {
      return 'Accept the HIT to unlock the study interface.';
    }
    if (state.submissionMode !== 'mturk' && !isParticipantValid()) {
      return 'Enter your display name to begin.';
    }
    return null;
  }

  function setControlsLocked(locked) {
    getChoiceInputs().forEach((choice) => {
      choice.disabled = locked;
    });
    elements.backButton.disabled = locked || state.index === 0;
    if (locked) {
      elements.nextButton.disabled = true;
      if (elements.skipButton) {
        elements.skipButton.disabled = true;
      }
    }
  }

  function buildSubmissionPayload() {
    const setId = state.questionSet || initialQuestionSet || 'questions_sample';
    return {
      questionSet: setId,
      completedAt: new Date().toISOString(),
      participant: state.participant,
      responses: state.responses.filter(Boolean),
      totalQuestions: state.questions.length,
    };
  }

  function downloadResponses() {
    persistSession();
    const payload = buildSubmissionPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const nameSlug = (state.participant.name || 'participant')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const filename = `responses_${nameSlug || 'participant'}.json`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    if (elements.submissionStatus) {
      elements.submissionStatus.textContent =
        'Download complete. Send the JSON file to the organizer.';
    }
  }

  async function sendResponses() {
    if (!config.responseEndpoint) {
      if (elements.submissionStatus) {
        elements.submissionStatus.textContent =
          'No upload endpoint configured. Use the download button instead.';
      }
      return;
    }
    persistSession();
    if (elements.sendButton) {
      elements.sendButton.disabled = true;
    }
    if (elements.submissionStatus) {
      elements.submissionStatus.textContent = 'Uploading…';
    }
    const ok = await syncToEndpoint(false);
    if (elements.submissionStatus) {
      elements.submissionStatus.textContent = ok
        ? 'Responses sent successfully!'
        : 'Upload failed. Please try again or use the download option.';
    }
    if (elements.sendButton) {
      elements.sendButton.disabled = false;
    }
  }

  function getChoiceInputs() {
    return Array.from(document.querySelectorAll('input[name="choice"]'));
  }

  function clone(value) {
    if (value === undefined || value === null) {
      return null;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function scheduleAutosave() {
    if (state.autosaveTimer) {
      window.clearTimeout(state.autosaveTimer);
    }
    state.autosaveTimer = window.setTimeout(() => {
      state.autosaveTimer = null;
      persistSession();
      const isPartial = !allQuestionsAnswered();
      syncToEndpoint(isPartial);
    }, AUTOSAVE_DELAY_MS);
  }

  function persistSession() {
    if (!state.sessionKey || !window.localStorage) {
      return;
    }
    const store = readSessions();
    store[state.sessionKey] = {
      questionSet: state.questionSet,
      responses: (state.responses || []).map((response) => response || null),
      index: state.index || 0,
      participant: { name: state.participant.name || '' },
      updatedAt: new Date().toISOString(),
    };
    writeSessions(store);
  }

  async function syncToEndpoint(isPartial) {
    if (!config.responseEndpoint) {
      return false;
    }
    if (state.remoteSaveController) {
      state.remoteSaveController.abort();
    }
    const controller = new AbortController();
    state.remoteSaveController = controller;
    let success = false;
    try {
      const payload = {
        ...buildSubmissionPayload(),
        autosave: true,
        status: isPartial ? 'in_progress' : 'completed',
        progress: {
          answered: state.responses.filter(Boolean).length,
          total: state.questions.length,
        },
      };
      await fetch(config.responseEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      success = true;
    } catch (error) {
      console.warn('Autosave failed', error);
    } finally {
      if (state.remoteSaveController === controller) {
        state.remoteSaveController = null;
      }
    }
    return success;
  }

  function readSessions() {
    if (cachedSessions) {
      return cachedSessions;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      cachedSessions = raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn('Unable to read stored sessions', error);
      cachedSessions = {};
    }
    return cachedSessions;
  }

  function writeSessions(store) {
    cachedSessions = store;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      console.warn('Unable to persist session progress', error);
    }
  }

  function getSessionRecord(nameKey) {
    const store = readSessions();
    return store?.[nameKey] || null;
  }

  function getNameKey(name) {
    return name?.trim().toLowerCase() || '';
  }

  async function start() {
    configureSubmissionMode();
    updateParticipantHint();
    bindEvents();
    if (state.questionSet) {
      await loadQuestions(state.questionSet);
    } else if (manifestPromise) {
      manifestPromise.catch(() => {});
    }
  }

  start();
})();
