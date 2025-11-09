(() => {
  const params = new URLSearchParams(window.location.search);
  const questionSet = params.get('questionSet') || 'questions_sample';
  const datasetUrl = `data/${questionSet}.json`;

  const elements = {
    axisLabel: document.getElementById('axisLabel'),
    progress: document.getElementById('progressLabel'),
    prompt: document.getElementById('questionPrompt'),
    contextBlock: document.getElementById('contextBlock'),
    contextImage: document.getElementById('contextImage'),
    contextCaption: document.getElementById('contextCaption'),
    videoA: document.getElementById('videoA'),
    videoB: document.getElementById('videoB'),
    labelA: document.getElementById('labelA'),
    labelB: document.getElementById('labelB'),
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
  };

  const state = {
    questions: [],
    index: 0,
    responses: [],
  };

  function initMTurkContext() {
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

    const isPreview = assignmentId === 'ASSIGNMENT_ID_NOT_AVAILABLE';
    elements.previewStatus.hidden = !isPreview;
    toggleStudyDisabled(isPreview);
    return !isPreview;
  }

  function toggleStudyDisabled(disabled) {
    [
      elements.backButton,
      elements.nextButton,
      ...elements.choices.map((choice) => choice),
    ].forEach((ctrl) => {
      ctrl.disabled = disabled;
    });
    elements.submitButton.disabled = true;
    if (disabled) {
      elements.helper.textContent =
        'Accept the HIT to unlock the study interface.';
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

    elements.axisLabel.textContent = `${question.axis || 'Axis'} — ${
      question.axisDetail || question.axis || ''
    }`.trim();
    elements.progress.textContent = `Question ${index + 1} of ${
      state.questions.length
    }`;
    elements.prompt.textContent = question.prompt || 'Question text missing.';

    toggleContext(question);
    configureMedia(elements.videoA, elements.labelA, question.videoA);
    configureMedia(elements.videoB, elements.labelB, question.videoB);

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

  function configureMedia(videoEl, labelEl, meta = {}) {
    const { src, label, poster } = meta;
    labelEl.textContent = label || 'Unlabeled clip';
    if (src) {
      if (videoEl.getAttribute('src') !== src) {
        videoEl.src = src;
      }
    } else {
      videoEl.removeAttribute('src');
    }
    if (poster) {
      videoEl.poster = poster;
    } else {
      videoEl.removeAttribute('poster');
    }
    videoEl.load();
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
      videoA: {
        label: question.videoA?.label || '',
        src: question.videoA?.src || '',
      },
      videoB: {
        label: question.videoB?.label || '',
        src: question.videoB?.src || '',
      },
      timestamp: new Date().toISOString(),
    };
  }

  function highlightChoice(choice) {
    document.querySelectorAll('.media-card').forEach((card) => {
      card.dataset.selected = card.dataset.choice === choice ? 'true' : 'false';
    });
  }

  function updateNavState() {
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
      elements.submissionPanel.hidden = true;
      elements.submitButton.disabled = true;
    }
  }

  function allQuestionsAnswered() {
    return (
      state.questions.length > 0 &&
      state.responses.filter(Boolean).length === state.questions.length
    );
  }

  function prepareSubmission() {
    elements.submissionPanel.hidden = false;
    elements.responsesInput.value = JSON.stringify(state.responses);
    elements.submitButton.disabled = false;
    elements.helper.textContent =
      'All questions answered. Review below and submit when ready.';
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
  }

  function start() {
    const interactive = initMTurkContext();
    bindEvents();
    if (interactive) {
      loadQuestions();
    } else {
      loadQuestions(); // allow previewers to at least read content
    }
  }

  start();
})();
