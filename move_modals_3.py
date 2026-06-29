with open('frontend/src/App.tsx', 'r') as f:
    content = f.read()

start_str = "          {me && (\n            <>\n              {gameState.phase === 'ChooseMergeSurvivor' && gameState.pendingSurvivorChoice?.playerId === playerId && ("
idx_start = content.find(start_str)

end_str = "              )}\n            </>\n          )}\n"
idx_end = content.find(end_str, idx_start) + len(end_str)

block = content[idx_start:idx_end]
content = content[:idx_start] + content[idx_end:]

# strip out the wrapping `me && <>` logic since we can just inject the modals
# actually, let's keep it wrapped in `{me && ( <> ... </> )}`
# wait, the FoundCorporation is NOT wrapped in `{me && ...}` anymore. It's just `{gameState.phase === 'FoundCorporation' && ...` (since `pendingFounding.playerId === playerId` already checks it's me implicitly, but usually `me` is needed to not crash on `playerId`).
# Actually, I'll just change `position: 'fixed'` to `position: 'absolute', borderRadius: 'inherit'` in the block.
# I already did that for ChooseMergeSurvivor!
# And I already wrapped MergeResolution in modal-backdrop.
# Let's just insert the block before the closing `</div>` of `.board`.

board_close_idx = content.find('        </div>\n\n        <div className="sidebar">')
content = content[:board_close_idx] + block + content[board_close_idx:]

with open('frontend/src/App.tsx', 'w') as f:
    f.write(content)

print("Done")
