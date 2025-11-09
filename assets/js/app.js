(() => {
  const params = new URLSearchParams(window.location.search);
  const questionSet = params.get('questionSet') || 'questions_sample';
  const datasetUrl = `data/${questionSet}.json`;
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
    videoA: document.getElementById('videoA'),
    videoB: document.getElementById('videoB'),
    choices: Array.from(document.querySelectorAll('input[name="choice"]')),
    helper: document.getElementById('helperText'),
    backButton: document.getElementById('backButton'),
    nextButton: document.getElementById('nextButton'),
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
    participantEmail: document.getElementById('participantEmail'),
    participantNotes: document.getElementById('participantNotes'),
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
    participant: {
      name: '',
      email: '',
      notes: '',
    },
  };

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

  async function loadQuestions() {
    try {
      const response = await fetch(datasetUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unable to load ${datasetUrl}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload) || payload.length === 0) {
        throw new Error('Question file is empty.');
      }
      state.questions = payload;
      renderQuestion(0);
      elements.helper.textContent = 'Make a selection to continue.';
    } catch (error) {
      console.error(error);
      elements.helper.textContent =
        'Could not load the question list. Confirm the file exists in /data.';
      elements.nextButton.disabled = true;
    }
  }

  function renderQuestion(index) {
    state.index = index;
    const question = state.questions[index];
    if (!question) {
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
    configureMedia(elements.videoA, question.videoA);
    configureMedia(elements.videoB, question.videoB);

    const previousResponse = state.responses[index]?.choice || null;
    elements.choices.forEach((input) => {
      input.checked = input.value === previousResponse;
    });
    highlightChoice(previousResponse);
    updateNavState();
  }

  function toggleContext(question) {
    const { contextImage, contextCaption } = question;
    const hasContext = Boolean(contextImage);
    elements.contextBlock.hidden = !hasContext;
    if (hasContext) {
      elements.contextImage.src = contextImage;
      elements.contextImage.alt =
        question.contextAlt || 'Reference diagram for this trial';
      elements.contextCaption.textContent =
        contextCaption || 'Reference image for the applied forces.';
    }
  }

  function configureMedia(videoEl, meta = {}) {
    const { src, poster } = meta || {};
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

    videoEl.load();
    autoPlayVideo(videoEl);
  }

  function handleChoice(event) {
    const choice = event.target.value;
    recordResponse(choice);
    highlightChoice(choice);
    updateNavState();
  }

  function recordResponse(choice) {
    const question = state.questions[state.index];
    state.responses[state.index] = {
      questionId: question.id || `question_${state.index + 1}`,
      axis: question.axis || null,
      prompt: question.prompt || '',
      choice,
      videoA: question.videoA ? { ...question.videoA } : null,
      videoB: question.videoB ? { ...question.videoB } : null,
      timestamp: new Date().toISOString(),
    };
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
    if (state.index >= state.questions.length - 1) {
      return;
    }
    renderQuestion(state.index + 1);
  }

  function goBack() {
    if (state.index === 0) {
      return;
    }
    renderQuestion(state.index - 1);
  }

  function bindEvents() {
    elements.choices.forEach((input) =>
      input.addEventListener('change', handleChoice)
    );
    elements.nextButton.addEventListener('click', goNext);
    elements.backButton.addEventListener('click', goBack);
    if (elements.participantForm) {
      elements.participantForm.addEventListener('input', handleParticipantInput);
    }
    if (elements.downloadButton) {
      elements.downloadButton.addEventListener('click', downloadResponses);
    }
    if (elements.sendButton) {
      elements.sendButton.addEventListener('click', sendResponses);
    }
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
    state.participant.name = elements.participantName?.value?.trim() || '';
    state.participant.email = elements.participantEmail?.value?.trim() || '';
    state.participant.notes = elements.participantNotes?.value?.trim() || '';
    updateParticipantHint();
    updateNavState();
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
    elements.choices.forEach((choice) => {
      choice.disabled = locked;
    });
    elements.backButton.disabled = locked || state.index === 0;
    if (locked) {
      elements.nextButton.disabled = true;
    }
  }

  function buildSubmissionPayload() {
    return {
      questionSet,
      completedAt: new Date().toISOString(),
      participant: state.participant,
      responses: state.responses.filter(Boolean),
      totalQuestions: state.questions.length,
    };
  }

  function downloadResponses() {
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
    const payload = buildSubmissionPayload();
    if (elements.sendButton) {
      elements.sendButton.disabled = true;
    }
    if (elements.submissionStatus) {
      elements.submissionStatus.textContent = 'Uploading…';
    }
    try {
      const response = await fetch(config.responseEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }
      if (elements.submissionStatus) {
        elements.submissionStatus.textContent = 'Responses sent successfully!';
      }
    } catch (error) {
      console.error(error);
      if (elements.submissionStatus) {
        elements.submissionStatus.textContent =
          'Upload failed. Please try again or use the download option.';
      }
    } finally {
      if (elements.sendButton) {
        elements.sendButton.disabled = false;
      }
    }
  }

  function start() {
    configureSubmissionMode();
    updateParticipantHint();
    bindEvents();
    loadQuestions();
  }

  start();
})();
