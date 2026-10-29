// Komponentspesifikasjon §2.3–2.5; API 0.2.0. Ingen I/O eller sesjonstoken.
export function canStartGame({ player, game, moduleRegistered, input, renewed }) {
  return Boolean(player?.id && game?.is_active === true && moduleRegistered === true &&
    input?.connection === 'connected' && input.inputAvailable === true && renewed === true);
}

export function requiresSession(route) {
  return !['launcher', 'testlab', 'login', 'register', 'leaderboard', 'history'].includes(route);
}

export function shouldRenew({ active, visible, hasUserInput, elapsedMs }) {
  return active === true && visible === true && hasUserInput === true && elapsedMs >= 300_000;
}

export function afterInputChange(phase, input) {
  // Tilbakevendende input gjenopptar aldri et pauset spill.
  return phase === 'playing' &&
    !(input?.connection === 'connected' && input.inputAvailable === true) ? 'paused' : phase;
}

export function resumeGame(phase, input, playerConfirmed) {
  return phase === 'paused' && playerConfirmed === true &&
    input?.connection === 'connected' && input.inputAvailable === true ? 'playing' : phase;
}

export function createAttempt({ playerId, game, attemptId }) {
  if (!playerId || !game?.id || !attemptId) throw new TypeError('Mangler forsøksidentitet');
  const { id, min_value, max_value } = game;
  return Object.freeze({ playerId, gameId: id, attemptId, min_value, max_value });
}

export function finishAttempt(attempt, status, value) {
  if (!['completed', 'incomplete'].includes(status)) throw new TypeError('Ugyldig status');
  if (status === 'completed') {
    if (!Number.isSafeInteger(value) || value < attempt.min_value || value > attempt.max_value)
      throw new RangeError('Ugyldig sluttverdi');
  } else if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
    throw new RangeError('Ugyldig delverdi');
  }
  return Object.freeze({ ...attempt, status, value });
}

export function resultRequest(attempt, signedInPlayerId) {
  if (signedInPlayerId !== attempt.playerId) throw new Error('SAME_PLAYER_REQUIRED');
  if (!['completed', 'incomplete'].includes(attempt.status)) throw new Error('ATTEMPT_NOT_FINISHED');
  return Object.freeze({
    url: `/api/v1/games/${encodeURIComponent(attempt.gameId)}/results`,
    method: 'POST', credentials: 'same-origin',
    headers: Object.freeze({ 'Content-Type': 'application/json', 'X-MBG-Request': '1' }),
    body: JSON.stringify({ attempt_id: attempt.attemptId, status: attempt.status, value: attempt.value })
  });
}

// Klassifiserer transportutfall, ikke rekordeffekt. Bekreftet response-body må
// valideres av API-klienten før denne funksjonen brukes.
export function submissionState(httpStatus, code) {
  if (httpStatus === 200 || httpStatus === 201) return 'saved';
  if (code === 'ATTEMPT_CONFLICT') return 'conflict';
  if (httpStatus === 401) return 'login-required';
  return 'unconfirmed';
}

export function questionBody(question, gameId) {
  if (typeof question !== 'string') throw new TypeError('Spørsmål må være tekst');
  const text = question.trim();
  if ([...text].length < 1 || [...text].length > 1000) throw new RangeError('Ugyldig spørsmålslengde');
  return gameId === undefined ? { question: text } : { question: text, game_id: gameId };
}
