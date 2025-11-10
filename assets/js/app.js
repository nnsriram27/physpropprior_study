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
    videoGrid: document.getElementById('videoGrid'),
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
    const previousChoice = state.responses[index]?.choice || null;
    renderOptions(question, previousChoice);
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
      label.textContent = option.title;
      header.appendChild(label);
      if (option.subtitle) {
        const subtitle = document.createElement('p');
        subtitle.className = 'option-subtitle';
        subtitle.textContent = option.subtitle;
        header.appendChild(subtitle);
      }
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
    const title = optionData.title
      ? optionData.title
      : `Option ${choiceValue}`;
    const subtitle =
      optionData.subtitle || optionData.label || optionData.method || '';
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
      subtitle,
      clips,
    };
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
    const response = {
      questionId: question.id || `question_${state.index + 1}`,
      fieldId: question.fieldId || question.field?.id || null,
      fieldLabel: question.fieldLabel || question.field?.label || null,
      dataset: question.dataset || null,
      axis: question.axis || null,
      axisDetail: question.axisDetail || null,
      prompt: question.prompt || '',
      choice,
      targetLevel: question.targetLevel || question.meta?.targetLevel || null,
      meta: clone(question.meta),
      videoA: clone(question.videoA),
      videoB: clone(question.videoB),
      optionA: clone(question.optionA),
      optionB: clone(question.optionB),
      timestamp: new Date().toISOString(),
    };
    if (question.field) {
      response.field = clone(question.field);
    }
    state.responses[state.index] = response;
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
    getChoiceInputs().forEach((choice) => {
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

  function getChoiceInputs() {
    return Array.from(document.querySelectorAll('input[name="choice"]'));
  }

  function clone(value) {
    if (value === undefined || value === null) {
      return null;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function start() {
    configureSubmissionMode();
    updateParticipantHint();
    bindEvents();
    loadQuestions();
  }

  start();
})();
