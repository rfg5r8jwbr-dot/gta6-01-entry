// Solmar Heat — save and load through localStorage.
// Keeps money, finished missions and the best score so a session can
// continue from the title screen. Never throws: a blocked storage just
// means no save.

const SAVE_KEY = 'solmar-heat-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number') return null;
    return {
      money: data.money,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      bestScore: typeof data.bestScore === 'number' ? data.bestScore : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(G) {
  try {
    const data = {
      money: G.player.money,
      missionsDone: G.missionsDone.slice(),
      bestScore: Math.max(G.saveData ? G.saveData.bestScore : 0, G.player.money),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    G.saveData = data;
  } catch {
    // Storage unavailable: the game still plays.
  }
}

// Score for the save file: money earned plus a bonus per finished mission.
export function currentScore(G) {
  return G.player.money + G.missionsDone.length * 1000;
}
