export function ErrorPage({ message, retry }: { message: string; retry?: string }) {
  return (
    <div class="page">
      <section class="section">
        <div class="wrap narrow">
          <h1>Something went wrong</h1>
          <p class="lead">{message}</p>
          <div class="actions-row">
            {retry ? (
              <a class="button button-primary" href={retry}>
                Try again
              </a>
            ) : null}
            <a class="button button-ghost" href="/">
              Go home
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
