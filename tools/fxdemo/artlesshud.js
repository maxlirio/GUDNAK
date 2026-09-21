// Migration in the HAND, so the HTML side of an art-less card can be looked at.
//
// The 3D table draws a face for a card with no art (see game/js/textures.js),
// but the HUD is DOM and had its own fallback — an empty `<div class="noart">`
// — so the hand, the stack panel, the graveyard and the end screen each showed
// a blank panel with a name beside it. A038 Migration is the only card in the
// game with no art, and "the card for Migration was missing" was true in five
// places at once.
(() => new Promise((done) => {
  let tries = 0;
  const boot = () => {
    if (!window.__table?.state) {
      if (++tries > 240) return done('NO TABLE — raise --wait');
      return void setTimeout(boot, 50);
    }
    const T = window.__table, st = T.state;
    // Migration, plus a painted card beside it for comparison: a drawn face
    // that only looks right next to nothing is not finished.
    const give = (defId) => {
      const uid = ++st.nextUid;
      st.players[0].hand.unshift({ uid, def: defId, owner: 0, fatigued: false, attachments: [] });
      return uid;
    };
    give('A022');
    give('A038');
    st.active = 0; st.actionsLeft = 3; delete st.pending; st.queue = [];
    T.resync();
    done(`hand: ${st.players[0].hand.map((c) => c.def).join(',')}`);
  };
  boot();
}))()
