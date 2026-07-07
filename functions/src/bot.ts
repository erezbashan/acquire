import { GameState, HeuristicBot } from '@acquire/shared';

const botImpl = new HeuristicBot();

export function processBotTurn(state: GameState, emitNewState: (state: GameState) => void) {
  const currentPlayerId = state.phase === 'MergeResolution' && state.pendingMerge 
    ? state.turnOrder[state.pendingMerge.playerResolutionIndex]
    : state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players.find(p => p.id === currentPlayerId);

  if (!currentPlayer || !currentPlayer.isBot) {
    return;
  }

  const BOT_CHATS = [
    "Just buying some cheap stocks.", 
    "You're going down!", 
    "Hmm...", 
    "I should have bought Luxor.", 
    "Why is everyone targeting me?", 
    "I love this game.", 
    "Are we merging soon?", 
    "My tiles are terrible.",
    "I'm feeling lucky today.",
    "This board is getting crowded."
  ];

  const hasHumanChatted = state.chat && state.chat.some(msg => {
    const senderPlayer = state.players.find(p => p.name === msg.sender || p.name.replace('🤖 ', '') === msg.sender);
    return senderPlayer && !senderPlayer.isBot;
  });

  const lastChat = state.lastBotChatAt || 0;
  const timeSinceLastChat = Date.now() - lastChat;
  
  if (!hasHumanChatted && timeSinceLastChat > 60000) { // At least 1 minute
    const chatInterval = Math.random() * 4 * 60 * 1000 + 60 * 1000; // 1 to 5 minutes
    if (timeSinceLastChat > chatInterval) {
      if (!state.chat) state.chat = [];
      const allBots = state.players.filter(p => p.isBot);
      const randomBot = allBots.length > 0 ? allBots[Math.floor(Math.random() * allBots.length)] : currentPlayer;
      state.chat.push({
        sender: randomBot.name.replace('🤖 ', ''),
        text: BOT_CHATS[Math.floor(Math.random() * BOT_CHATS.length)],
        timestamp: Date.now()
      });
      if (state.chat.length > 50) state.chat = state.chat.slice(state.chat.length - 50);
      state.lastBotChatAt = Date.now();
    }
  }

  const newState = botImpl.takeTurn(state, currentPlayerId);
  if (newState) {
    emitNewState(newState);
  }
}
