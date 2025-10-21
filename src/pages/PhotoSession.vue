<template>
  <main class="stub-screen">
    <h1>Photo Session (stub)</h1>
    <p>This screen will guide the user through the shooting flow.</p>
  </main>
</template>

<style scoped>
.stub-screen {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  background: radial-gradient(circle at center, rgba(255, 0, 43, 0.12), rgba(0, 0, 0, 0.9));
  color: #fff;
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  margin: 0;
}

p {
  font-size: clamp(1.2rem, 2.5vw, 1.75rem);
  margin: 0;
  max-width: 32rem;
  opacity: 0.75;
}
</style>
