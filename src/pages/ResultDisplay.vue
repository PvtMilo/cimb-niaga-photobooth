<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

const status = ref('checking')
const assetPath = ref('')
const completedAt = ref('')
const errorMessage = ref('')
const isRestarting = ref(false)
const isDownloading = ref(false)

const hasAsset = computed(() => Boolean(assetPath.value))
const assetUrl = computed(() => {
  if (!assetPath.value) return ''
  if (/^https?:\/\//i.test(assetPath.value)) {
    return assetPath.value
  }
  if (assetPath.value.startsWith('/')) {
    return `${apiBaseUrl}${assetPath.value}`
  }
  return ''
})

const assetHint = computed(() => (!assetUrl.value ? assetPath.value : ''))

const fetchLatestState = async () => {
  try {
    const response = await fetch(`${apiBaseUrl}/session/status`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Status request failed with ${response.status}`)
    }

    const payload = await response.json()
    const state = payload?.state ?? {}
    status.value = state?.status ?? 'idle'
    assetPath.value = state?.asset_path ?? ''
    completedAt.value = state?.completed_at ?? ''
    errorMessage.value = ''

    if (status.value === 'completed') {
      return
    }

    if (status.value === 'in_progress') {
      router.replace({ name: 'photo-session' })
    } else {
      router.replace({ name: 'home' })
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Unable to load the photo session result.'
  }
}

const goHome = () => {
  router.replace({ name: 'home' })
}

const retakeSession = async () => {
  if (isRestarting.value) return
  isRestarting.value = true
  errorMessage.value = ''
  try {
    const resetResponse = await fetch(`${apiBaseUrl}/session/reset`, { method: 'POST' })
    if (!resetResponse.ok) {
      throw new Error('Failed to reset the session.')
    }

    const startResponse = await fetch(`${apiBaseUrl}/session/start`, { method: 'POST' })
    if (!startResponse.ok) {
      const payload = await startResponse.json().catch(() => ({}))
      throw new Error(payload?.message || 'Failed to start a new session.')
    }
    router.replace({ name: 'photo-session' })
  } catch (error) {
    console.error(error)
    errorMessage.value =
      error instanceof Error && error.message
        ? error.message
        : 'Unable to restart the photo booth.'
  } finally {
    isRestarting.value = false
  }
}

const downloadAsset = () => {
  if (isDownloading.value) return
  if (!hasAsset.value) {
    errorMessage.value = 'Photo not ready for download.'
    return
  }

  isDownloading.value = true
  try {
    if (assetUrl.value) {
      window.open(assetUrl.value, '_blank', 'noopener')
    } else if (assetHint.value) {
      errorMessage.value = `File saved at: ${assetHint.value}`
    } else {
      errorMessage.value = 'No download URL available yet.'
    }
  } finally {
    isDownloading.value = false
  }
}

onMounted(() => {
  fetchLatestState()
})
</script>

<template>
  <main class="result-screen">
    <section class="preview-card">
      <div class="image-frame" :class="{ empty: !assetUrl }">
        <img
          v-if="assetUrl"
          :src="assetUrl"
          alt="Latest photo booth capture"
          class="result-image"
        />
        <div v-else class="placeholder">
          <h1 v-if="hasAsset">Photo ready!</h1>
          <h1 v-else>Awaiting final image...</h1>
          <p v-if="assetHint">Saved at: {{ assetHint }}</p>
          <p v-else>Once DSLRBooth exports the photo we will show a preview here.</p>
        </div>
      </div>
      <p v-if="completedAt" class="timestamp">Captured at {{ completedAt }}</p>
    </section>

    <section class="actions">
      <button
        type="button"
        class="action-btn primary"
        :disabled="isRestarting"
        @click="retakeSession"
      >
        <span v-if="isRestarting">Starting...</span>
        <span v-else>Retake</span>
      </button>
      <button
        type="button"
        class="action-btn secondary"
        :disabled="isDownloading || !hasAsset"
        @click="downloadAsset"
      >
        <span v-if="isDownloading">Preparing...</span>
        <span v-else>Download</span>
      </button>
      <button type="button" class="action-btn ghost" @click="goHome">
        Home
      </button>
    </section>

    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
  </main>
</template>

<style scoped>
.result-screen {
  width: 100vw;
  height: 100vh;
  padding: clamp(2rem, 4vw, 3rem);
  background: radial-gradient(circle at center, rgba(0, 180, 255, 0.18), rgba(0, 0, 0, 0.92));
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(2rem, 5vw, 3rem);
  text-align: center;
}

.preview-card {
  max-width: 960px;
  width: 100%;
  background: rgba(8, 12, 20, 0.9);
  border-radius: 36px;
  padding: clamp(1.5rem, 4vw, 3rem);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.38);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
}

.image-frame {
  width: min(100%, 720px);
  aspect-ratio: 3 / 4;
  border-radius: 28px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  border: 2px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-frame.empty {
  border-style: dashed;
}

.result-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.placeholder {
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  color: rgba(255, 255, 255, 0.85);
}

.placeholder h1 {
  font-size: clamp(2.4rem, 5vw, 3.4rem);
  margin: 0;
}

.placeholder p {
  font-size: clamp(1.1rem, 2.5vw, 1.6rem);
  margin: 0;
  opacity: 0.85;
}

.timestamp {
  margin: 0;
  font-size: clamp(1rem, 2vw, 1.4rem);
  opacity: 0.7;
}

.actions {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  justify-content: center;
}

.action-btn {
  min-width: 11rem;
  padding: 1rem 2.75rem;
  border-radius: 999px;
  font-size: clamp(1.2rem, 2.8vw, 1.8rem);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.action-btn.primary {
  background: #ff002b;
  color: #fff;
  box-shadow: 0 20px 36px rgba(255, 0, 43, 0.35);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.25);
}

.action-btn.ghost {
  background: transparent;
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.25);
}

.action-btn:hover,
.action-btn:focus-visible {
  transform: translateY(-2px);
  outline: none;
}

.action-btn:active {
  transform: translateY(0);
}

.action-btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.error-banner {
  margin: 0;
  font-size: clamp(1.1rem, 2.4vw, 1.6rem);
  color: #ff97a8;
}
</style>
