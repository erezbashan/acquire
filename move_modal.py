import re

with open('frontend/src/App.tsx', 'r') as f:
    content = f.read()

# Find the board closing tag
board_close_idx = content.find('        </div>\n\n        <div className="sidebar">')
if board_close_idx == -1:
    print("Could not find board closing tag")
    exit(1)

# Find the FoundCorporation block
# Starts with:               {gameState.phase === 'FoundCorporation' && gameState.pendingFounding?.playerId === playerId && (
# Ends with:               )}
start_str = "              {gameState.phase === 'FoundCorporation' && gameState.pendingFounding?.playerId === playerId && ("
start_idx = content.find(start_str)

if start_idx == -1:
    print("Could not find FoundCorporation block")
    exit(1)

end_str = "              )}\n"
# Find the end of the block
end_idx = content.find(end_str, start_idx) + len(end_str)

block = content[start_idx:end_idx]

# Remove the block from its original position
content = content[:start_idx] + content[end_idx:]

# Change position: 'fixed' to position: 'absolute' inside the block
block = block.replace("position: 'fixed'", "position: 'absolute', borderRadius: 'inherit'")

# Find the board closing tag again after modification
board_close_idx = content.find('        </div>\n\n        <div className="sidebar">')

# Insert the block before the closing tag of .board
content = content[:board_close_idx] + block + content[board_close_idx:]

with open('frontend/src/App.tsx', 'w') as f:
    f.write(content)

print("Done")
