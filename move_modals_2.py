import re

with open('frontend/src/App.tsx', 'r') as f:
    content = f.read()

# We need to move the other modals into the board.
# The other modals are at the end of the file.
# They start from `{gameState.phase === 'ChooseMergeSurvivor'` and end before `{gameState.phase === 'GameOver'`
# Actually, let's just find them and move them.

start_survivor = "              {gameState.phase === 'ChooseMergeSurvivor' && gameState.pendingSurvivorChoice?.playerId === playerId && ("
idx_survivor = content.find(start_survivor)

if idx_survivor != -1:
    end_survivor_str = "              )}\n"
    # Find the end of the block. But there is also MergeResolution right after it.
    # Let's find the GameOver start.
    end_merge = "              {gameState.phase === 'GameOver' && showGameOver && ("
    idx_gameover = content.find(end_merge)
    
    if idx_gameover != -1:
        # The block to move is from idx_survivor to idx_gameover - something (like `          )}` before it)
        # Actually, let's look at the structure:
        #              )}
        #              {isMyTurn && gameState.phase === 'MergeResolution' && pm && dCorp && aCorp && (
        # ...
        #              )}
        #            </>
        #          )}
        
        # Let's just find the `</>` string that closes the `me && <>` block at the bottom
        end_fragment = "            </>\n          )}\n"
        idx_end_fragment = content.find(end_fragment, idx_survivor)
        
        block = content[idx_survivor:idx_end_fragment]
        
        # Remove it from there
        content = content[:idx_survivor] + content[idx_end_fragment:]
        
        # Change position: fixed to absolute in block
        block = block.replace("position: 'fixed'", "position: 'absolute', borderRadius: 'inherit'")
        
        # Find where to insert it: right after the FoundCorporation block inside .board
        # Look for the closing tag of .board
        board_close_idx = content.find('        </div>\n\n        <div className="sidebar">')
        
        content = content[:board_close_idx] + block + content[board_close_idx:]

with open('frontend/src/App.tsx', 'w') as f:
    f.write(content)

print("Done")
