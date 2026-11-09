import { supabase, isSupabaseConfigured } from "./supabase";
import { CYBER_QUIZ_BANK, QuizQuestion, QuizCategory } from "../data/cyberQuizBank";

export interface ChildQuizProgress {
  childId: string;
  currentLevel: 1 | 2 | 3;
  questionsAttempted: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPercentage: number;
  streak: number;
  weakConcepts: QuizCategory[];
  exhaustedQuestionIds: string[];
  currentCycle: number;
  updatedAt: string;
}

export interface QuizAnswerRecord {
  id?: string;
  childId: string;
  questionId: string;
  category: QuizCategory;
  difficultyLevel: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
  answeredAt: string;
}

// Local storage key helper
function getLocalKey(childId: string): string {
  return `GUARDIAN_QUIZ_PROGRESS_${childId || "default"}`;
}

function getLocalHistoryKey(childId: string): string {
  return `GUARDIAN_QUIZ_HISTORY_${childId || "default"}`;
}

/**
 * Initializes a clean quiz progress state for a child.
 */
export function createDefaultProgress(childId: string): ChildQuizProgress {
  return {
    childId: childId || "default",
    currentLevel: 1,
    questionsAttempted: 0,
    correctCount: 0,
    incorrectCount: 0,
    accuracyPercentage: 0,
    streak: 0,
    weakConcepts: [],
    exhaustedQuestionIds: [],
    currentCycle: 1,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Fetches the persistent quiz progress for the authenticated child.
 * Tries Supabase public.child_quiz_progress first, then falls back to localStorage.
 */
export async function fetchChildQuizProgress(childId: string): Promise<ChildQuizProgress> {
  let authoritativeChildId = childId;

  // Authoritatively derive active session UID if authenticated via Supabase
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        authoritativeChildId = session.user.id;
      }
    } catch (_) {}
  }

  const fallback = createDefaultProgress(authoritativeChildId);

  // Try reading from localStorage first as fast cache
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem(getLocalKey(authoritativeChildId));
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed === "object") {
          Object.assign(fallback, parsed);
        }
      }
    } catch (_) {}
  }

  if (!isSupabaseConfigured || !authoritativeChildId || authoritativeChildId === "default" || authoritativeChildId === "guest" || authoritativeChildId === "guest-child") {
    return fallback;
  }

  try {
    const { data, error } = await (supabase as any)
      .from("child_quiz_progress")
      .select("*")
      .eq("child_id", authoritativeChildId)
      .maybeSingle();

    if (error) {
      console.warn("[cyberQuizEngine] Warning reading child_quiz_progress:", error.message);
      return fallback;
    }

    if (data) {
      const dbProgress: ChildQuizProgress = {
        childId: data.child_id,
        currentLevel: (data.current_level as 1 | 2 | 3) || 1,
        questionsAttempted: data.questions_attempted || 0,
        correctCount: data.correct_count || 0,
        incorrectCount: data.incorrect_count || 0,
        accuracyPercentage: Number(data.accuracy_percentage) || 0,
        streak: data.streak || 0,
        weakConcepts: (data.weak_concepts as QuizCategory[]) || [],
        exhaustedQuestionIds: data.exhausted_question_ids || [],
        currentCycle: data.current_cycle || 1,
        updatedAt: data.updated_at || new Date().toISOString()
      };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(getLocalKey(authoritativeChildId), JSON.stringify(dbProgress));
        } catch (_) {}
      }

      return dbProgress;
    }
  } catch (err) {
    console.warn("[cyberQuizEngine] Error querying child quiz progress:", err);
  }

  return fallback;
}

/**
 * Selects the next unexhausted question for the child using adaptive level and category weighting.
 * Shuffles available questions and prevents repeats until the pool is exhausted.
 */
export function getNextQuizQuestion(
  progress: ChildQuizProgress,
  excludeQuestionId?: string | null
): QuizQuestion {
  const exhaustedSet = new Set(progress.exhaustedQuestionIds || []);
  const level = progress.currentLevel || 1;

  // 1. Eligible questions in current difficulty level not yet exhausted
  let candidates = CYBER_QUIZ_BANK.filter(
    q => q.difficulty === level && !exhaustedSet.has(q.id) && q.id !== excludeQuestionId
  );

  // 2. If no questions left in current level, check other levels that are unexhausted
  if (candidates.length === 0) {
    candidates = CYBER_QUIZ_BANK.filter(
      q => !exhaustedSet.has(q.id) && q.id !== excludeQuestionId
    );
  }

  // 3. If the entire question pool is exhausted, reset the cycle!
  if (candidates.length === 0) {
    // New cycle with fresh candidates
    candidates = CYBER_QUIZ_BANK.filter(q => q.id !== excludeQuestionId);
  }

  // 4. Prioritize weak concepts if any exist
  if (progress.weakConcepts && progress.weakConcepts.length > 0) {
    const weakCandidates = candidates.filter(q => progress.weakConcepts.includes(q.category));
    if (weakCandidates.length > 0) {
      candidates = weakCandidates;
    }
  }

  // 5. Randomly shuffle candidates
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex] || CYBER_QUIZ_BANK[0];
}

/**
 * Records a child's answer, updates progress and adaptive level, and persists to Supabase and cache.
 * Strictly uses authenticated Supabase session UID as child_id (never trusts client-supplied UID).
 */
export async function recordQuizAnswer(
  childId: string,
  question: QuizQuestion,
  selectedOptionIndex: number,
  currentProgress: ChildQuizProgress
): Promise<{
  isCorrect: boolean;
  updatedProgress: ChildQuizProgress;
  leveledUp: boolean;
  leveledDown: boolean;
}> {
  // 1. Authoritative Session UID resolution (Never trust client-supplied child UID)
  let authoritativeChildId = childId;
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        authoritativeChildId = session.user.id;
      }
    } catch (_) {}
  }

  // 2. Prevent duplicate submissions for the same question attempt in current cycle
  const exhaustedList = [...(currentProgress.exhaustedQuestionIds || [])];
  if (exhaustedList.includes(question.id)) {
    console.warn(`[cyberQuizEngine] Question ${question.id} was already answered in current cycle. Skipping duplicate write.`);
    return {
      isCorrect: Boolean(question.options[selectedOptionIndex]?.isCorrect),
      updatedProgress: currentProgress,
      leveledUp: false,
      leveledDown: false
    };
  }

  const selectedOption = question.options[selectedOptionIndex];
  const isCorrect = Boolean(selectedOption?.isCorrect);

  const newAttempted = currentProgress.questionsAttempted + 1;
  const newCorrect = currentProgress.correctCount + (isCorrect ? 1 : 0);
  const newIncorrect = currentProgress.incorrectCount + (isCorrect ? 0 : 1);
  const newAccuracy = Math.round((newCorrect / newAttempted) * 100);
  const newStreak = isCorrect ? currentProgress.streak + 1 : 0;

  // Update exhausted list
  exhaustedList.push(question.id);

  // Check if cycle is complete (all questions answered)
  let currentCycle = currentProgress.currentCycle || 1;
  let finalExhaustedList = exhaustedList;
  if (exhaustedList.length >= CYBER_QUIZ_BANK.length) {
    currentCycle += 1;
    finalExhaustedList = []; // Start fresh cycle!
  }

  // Update weak concepts
  let weakConcepts = [...(currentProgress.weakConcepts || [])];
  if (!isCorrect) {
    if (!weakConcepts.includes(question.category)) {
      weakConcepts.push(question.category);
    }
  } else {
    // If answered correctly and was in weak concepts, remove it
    weakConcepts = weakConcepts.filter(c => c !== question.category);
  }

  // Adaptive Difficulty Progression:
  // Level 1 -> 2: If at least 3 correct in a row or accuracy >= 75% (with >= 3 attempted at level 1)
  // Level 2 -> 3: If accuracy >= 80% with >= 6 total attempted
  // Level down: If streak == 0 and 3 incorrect in a row at higher levels
  let nextLevel = currentProgress.currentLevel;
  let leveledUp = false;
  let leveledDown = false;

  if (currentProgress.currentLevel === 1) {
    if (newStreak >= 3 || (newAccuracy >= 75 && newAttempted >= 3)) {
      nextLevel = 2;
      leveledUp = true;
    }
  } else if (currentProgress.currentLevel === 2) {
    if (newStreak >= 4 || (newAccuracy >= 80 && newAttempted >= 6)) {
      nextLevel = 3;
      leveledUp = true;
    } else if (!isCorrect && currentProgress.incorrectCount >= 3 && newAccuracy < 50) {
      nextLevel = 1;
      leveledDown = true;
    }
  } else if (currentProgress.currentLevel === 3) {
    if (!isCorrect && currentProgress.incorrectCount >= 4 && newAccuracy < 60) {
      nextLevel = 2;
      leveledDown = true;
    }
  }

  const updatedProgress: ChildQuizProgress = {
    childId: authoritativeChildId,
    currentLevel: nextLevel,
    questionsAttempted: newAttempted,
    correctCount: newCorrect,
    incorrectCount: newIncorrect,
    accuracyPercentage: newAccuracy,
    streak: newStreak,
    weakConcepts,
    exhaustedQuestionIds: finalExhaustedList,
    currentCycle,
    updatedAt: new Date().toISOString()
  };

  // 1. Update localStorage cache immediately
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getLocalKey(authoritativeChildId), JSON.stringify(updatedProgress));

      // Append to local history array
      const historyRaw = localStorage.getItem(getLocalHistoryKey(authoritativeChildId));
      const historyList = historyRaw ? JSON.parse(historyRaw) : [];
      historyList.unshift({
        questionId: question.id,
        category: question.category,
        difficultyLevel: question.difficulty,
        selectedOptionIndex,
        isCorrect,
        answeredAt: updatedProgress.updatedAt
      });
      localStorage.setItem(getLocalHistoryKey(authoritativeChildId), JSON.stringify(historyList.slice(0, 50)));
    } catch (_) {}
  }

  // 2. Persist to Supabase if configured and authenticated
  if (isSupabaseConfigured && authoritativeChildId && authoritativeChildId !== "default" && authoritativeChildId !== "guest" && authoritativeChildId !== "guest-child") {
    // 2a. Atomic Upsert to child_quiz_progress
    const { error: progErr } = await (supabase as any)
      .from("child_quiz_progress")
      .upsert({
        child_id: authoritativeChildId,
        current_level: updatedProgress.currentLevel,
        questions_attempted: updatedProgress.questionsAttempted,
        correct_count: updatedProgress.correctCount,
        incorrect_count: updatedProgress.incorrectCount,
        accuracy_percentage: updatedProgress.accuracyPercentage,
        streak: updatedProgress.streak,
        weak_concepts: updatedProgress.weakConcepts,
        exhausted_question_ids: updatedProgress.exhaustedQuestionIds,
        current_cycle: updatedProgress.currentCycle,
        updated_at: updatedProgress.updatedAt
      }, { onConflict: "child_id" });

    if (progErr) {
      console.error("[cyberQuizEngine] Critical error updating child_quiz_progress in Supabase:", {
        code: progErr.code,
        message: progErr.message,
        details: progErr.details,
        childId: authoritativeChildId
      });
      throw new Error(`Failed to save quiz progress to database: ${progErr.message}`);
    }

    // 2b. Insert audit history log into child_quiz_history
    const { error: histErr } = await (supabase as any)
      .from("child_quiz_history")
      .insert({
        child_id: authoritativeChildId,
        question_id: question.id,
        category: question.category,
        difficulty_level: question.difficulty,
        selected_option_index: selectedOptionIndex,
        is_correct: isCorrect,
        answered_at: updatedProgress.updatedAt
      });

    if (histErr) {
      console.error("[cyberQuizEngine] Critical error inserting child_quiz_history into Supabase:", {
        code: histErr.code,
        message: histErr.message,
        details: histErr.details,
        childId: authoritativeChildId,
        questionId: question.id
      });
      throw new Error(`Failed to save quiz history log to database: ${histErr.message}`);
    }
  }

  return {
    isCorrect,
    updatedProgress,
    leveledUp,
    leveledDown
  };
}

/**
 * Resets exhausted questions and advances cycle counter.
 */
export function resetQuizCycle(progress: ChildQuizProgress): ChildQuizProgress {
  return {
    ...progress,
    exhaustedQuestionIds: [],
    currentCycle: (progress.currentCycle || 1) + 1,
    updatedAt: new Date().toISOString()
  };
}
