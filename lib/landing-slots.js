/**
 * Registry of every editable landing text slot: the CMS override key, the i18n
 * key whose translation is the default, and the shipped English fallback.
 * Rendering (components/landing/Landing.js) and the /admin/content editor both
 * derive from this list, so the admin can create an override for ANY slot
 * without needing an existing one.
 */

export const LANDING_SLOTS = [
  { id: 'navSignIn', tKey: 'lpNavSignIn', en: 'Sign in' },
  { id: 'navStart', tKey: 'lpNavStart', en: 'Get started' },

  { id: 'heroEyebrow', tKey: 'lpHeroEyebrow', en: 'Spaced repetition · HSK 1–6 · Free' },
  { id: 'heroSubLead', tKey: 'lpHeroSubLead', en: 'Learn Chinese words that stay learned.' },
  {
    id: 'heroSubRest',
    tKey: 'lpHeroSubRest',
    en: 'Flashcards and quizzes scheduled by an SRS that knows exactly when you are about to forget.',
  },
  { id: 'heroCta', tKey: 'lpHeroCta', en: 'Start learning free' },
  { id: 'heroSignIn', tKey: 'lpHeroSignIn', en: 'Sign in' },
  { id: 'heroMicro', tKey: 'lpHeroMicro', en: 'free forever · no ads · no credit card' },

  { id: 'featuresEyebrow', tKey: 'lpFeaturesEyebrow', en: 'Why it sticks' },
  { id: 'featuresTitleLead', tKey: 'lpFeaturesTitleLead', en: 'Built for memory,' },
  { id: 'featuresTitleRest', tKey: 'lpFeaturesTitleRest', en: 'not busywork.' },

  { id: 'feat_srs_title', tKey: 'lpFeatSrsTitle', en: 'SRS spaced repetition' },
  {
    id: 'feat_srs_text',
    tKey: 'lpFeatSrsText',
    en: 'Reviews land right before you forget. A proven SM-2 schedule with four honest grades — no cramming, no wasted reps.',
  },
  { id: 'feat_hsk_title', tKey: 'lpFeatHskTitle', en: 'HSK 1–6, five thousand words' },
  {
    id: 'feat_hsk_text',
    tKey: 'lpFeatHskText',
    en: 'Every official level plus textbook packs — searchable by hanzi, pinyin or meaning, with stroke order and audio.',
  },
  { id: 'feat_decks_title', tKey: 'lpFeatDecksTitle', en: 'Personal decks' },
  {
    id: 'feat_decks_text',
    tKey: 'lpFeatDecksText',
    en: 'Collect words from any pack into your own decks and study exactly what your course — or your curiosity — demands.',
  },
  { id: 'feat_progress_title', tKey: 'lpFeatProgressTitle', en: 'Progress & streaks' },
  {
    id: 'feat_progress_text',
    tKey: 'lpFeatProgressText',
    en: 'Daily goals, streaks and per-level mastery bars turn showing up every day into the easiest part.',
  },

  { id: 'stepsEyebrow', tKey: 'lpStepsEyebrow', en: 'How it works' },
  { id: 'stepsTitleLead', tKey: 'lpStepsTitleLead', en: 'Three steps,' },
  { id: 'stepsTitleRest', tKey: 'lpStepsTitleRest', en: 'a few minutes a day.' },
  { id: 'step_pick_title', tKey: 'lpStep1Title', en: 'Pick your words' },
  {
    id: 'step_pick_text',
    tKey: 'lpStep1Text',
    en: 'Choose an HSK level, a textbook pack, or build a deck of your own.',
  },
  { id: 'step_study_title', tKey: 'lpStep2Title', en: 'Study smart' },
  {
    id: 'step_study_text',
    tKey: 'lpStep2Text',
    en: 'Flip flashcards or take quizzes — every answer reschedules the card.',
  },
  { id: 'step_stick_title', tKey: 'lpStep3Title', en: 'Watch it stick' },
  {
    id: 'step_stick_text',
    tKey: 'lpStep3Text',
    en: 'Streaks, goals and level mastery show words moving into long-term memory.',
  },

  { id: 'stat_words_label', tKey: 'lpStatWords', en: 'words' },
  { id: 'stat_levels_label', tKey: 'lpStatLevels', en: 'every level' },
  { id: 'stat_packs_label', tKey: 'lpStatPacks', en: 'textbook packs' },
  { id: 'stat_free_label', tKey: 'lpStatFree', en: 'free' },

  { id: 'ctaEyebrow', tKey: 'lpCtaEyebrow', en: 'Start today' },
  { id: 'ctaTitleLead', tKey: 'lpCtaTitleLead', en: 'Ready when you are.' },
  { id: 'ctaTitleRest', tKey: 'lpCtaTitleRest', en: 'The first review takes a minute.' },
  { id: 'ctaButton', tKey: 'lpCtaButton', en: 'Start learning free' },
  { id: 'ctaMicro', tKey: 'lpCtaMicro', en: 'no credit card · no ads · just hanzi' },

  { id: 'footerTag', tKey: null, en: 'HaoHao XueXi' },
  { id: 'footerCopy', tKey: 'lpFooterCopy', en: 'made for Chinese learners' },
]
