export function HomePage() {
  return (
    <div class="page home">
      <section class="hero">
        <div class="wrap hero-inner">
          <div class="hero-text">
            <p class="eyebrow">Kelpwick, California</p>
            <h1>The ocean, up close.</h1>
            <p class="lead">
              Meet the creatures of the deep and the coast that looks after them. Membership gives
              you a year of visits, member prices and a card for everyone in your family.
            </p>
            <div class="hero-actions">
              <a class="button button-primary" href="/plans">
                See membership plans
              </a>
              <a class="button button-ghost" href="/gate">
                Try the gate
              </a>
            </div>
          </div>
          <div class="hero-media">
            <img src="/kelp.jpg" alt="Sunlit kelp forest" width="1279" height="1600" />
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="eyebrow">Your membership</p>
          <h2>Everything your membership covers.</h2>
          <div class="scene-grid">
            <a class="scene-card" href="/plans">
              <span class="scene-number">1</span>
              <h3>Plans & prices</h3>
              <p>Find the membership that fits your family.</p>
            </a>
            <a class="scene-card" href="/join">
              <span class="scene-number">2</span>
              <h3>Join</h3>
              <p>Sign up online in a minute.</p>
            </a>
            <a class="scene-card" href="/cards">
              <span class="scene-number">3</span>
              <h3>Member cards</h3>
              <p>Your cards, ready for the gate and the till.</p>
            </a>
            <a class="scene-card" href="/gate">
              <span class="scene-number">4</span>
              <h3>At the gate</h3>
              <p>Tap your card and come on in.</p>
            </a>
            <a class="scene-card" href="/till">
              <span class="scene-number">5</span>
              <h3>Café & shop</h3>
              <p>Member prices and guest passes.</p>
            </a>
            <a class="scene-card" href="/changes">
              <span class="scene-number">6</span>
              <h3>When things change</h3>
              <p>Change, renew or cancel any time.</p>
            </a>
          </div>
        </div>
      </section>

      <section class="section section-tint">
        <div class="wrap two-col">
          <div class="two-col-media">
            <img
              src="/jellies.jpg"
              alt="Moon jellies on a dark background"
              width="1200"
              height="1600"
            />
          </div>
          <div class="two-col-text">
            <p class="eyebrow">Plan your visit</p>
            <h2>Open every day of the year.</h2>
            <p class="lead">
              Members get early access on weekends and member prices in the café and gift shop.
            </p>
            <a class="button button-primary" href="/plans">
              See membership plans
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
