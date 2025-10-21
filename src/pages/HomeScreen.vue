<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const promoModules = import.meta.glob('../../public/images/promos/*.{png,jpg,jpeg,webp,avif,gif}', {
  eager: true,
  import: 'default',
  query: '?url',
})

const promoSlides = Object.entries(promoModules)
  .filter(([, url]) => typeof url === 'string' && url)
  .map(([path, url]) => {
    const parts = path.split('/')
    const filename = parts[parts.length - 1] ?? path
    const label = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Promo'
    return {
      id: filename,
      type: 'image',
      src: url,
      alt: `${label} promotion`,
    }
  })
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }))

const slidesSource = ref(promoSlides)
const placeholderSlide = {
  id: 'placeholder',
  type: 'placeholder',
  message: 'No promos available',
}

const hasRealSlides = computed(() => slidesSource.value.length > 0)
const slides = computed(() => (hasRealSlides.value ? slidesSource.value : [placeholderSlide]))

const initialTrackPosition = hasRealSlides.value ? 1 : 0
const trackPosition = ref(initialTrackPosition)
const currentIndex = ref(0)

watch(
  hasRealSlides,
  (value) => {
    trackPosition.value = value ? 1 : 0
    currentIndex.value = 0
  },
  { immediate: false }
)

const trackSlides = computed(() => {
  if (!hasRealSlides.value) {
    return slides.value
  }
  const first = slides.value[0]
  const last = slides.value[slides.value.length - 1]
  return [
    { ...last, id: `${last.id}-clone-leading` },
    ...slides.value,
    { ...first, id: `${first.id}-clone-trailing` },
  ]
})

const activeSlide = computed(() => slides.value[currentIndex.value] ?? slides.value[0])
const activeSlideId = computed(() => activeSlide.value?.id ?? 'placeholder')

const carouselRoot = ref(null)
const containerWidth = ref(0)
const dragOffset = ref(0)
const dragPercent = computed(() =>
  containerWidth.value ? (dragOffset.value / containerWidth.value) * 100 : 0
)

const allowTransition = ref(true)
const isAnimating = ref(false)
const isPointerDown = ref(false)
const isDragging = ref(false)
const pointerId = ref(null)
const dragStartX = ref(0)

const isModalOpen = ref(false)
const cursorHidden = ref(false)
let cursorTimer = null

const updateBounds = () => {
  if (carouselRoot.value) {
    containerWidth.value = carouselRoot.value.clientWidth
  }
}

const trackTransform = computed(() => {
  const basePosition = hasRealSlides.value ? trackPosition.value : 0
  const base = -(basePosition * 100)
  const adjusted = base + dragPercent.value
  return `translate3d(${adjusted}%, 0, 0)`
})

const trackStyle = computed(() => ({
  transform: trackTransform.value,
  transition:
    allowTransition.value && !isDragging.value
      ? 'transform 450ms cubic-bezier(0.33, 1, 0.68, 1)'
      : 'none',
}))

const resetCursorTimer = () => {
  cursorHidden.value = false
  if (cursorTimer) {
    clearTimeout(cursorTimer)
  }
  if (isModalOpen.value) {
    return
  }
  cursorTimer = setTimeout(() => {
    cursorHidden.value = true
  }, 3000)
}

const openModal = () => {
  if (isModalOpen.value) return
  if (cursorTimer) {
    clearTimeout(cursorTimer)
  }
  cursorHidden.value = false
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  resetCursorTimer()
}

const confirmStart = () => {
  isModalOpen.value = false
  router.push('/photo-session')
}

const goNext = () => {
  if (!hasRealSlides.value || isAnimating.value) return
  allowTransition.value = true
  dragOffset.value = 0
  isAnimating.value = true
  trackPosition.value += 1
  const nextIndex = (currentIndex.value + 1) % slides.value.length
  currentIndex.value = nextIndex
}

const goPrev = () => {
  if (!hasRealSlides.value || isAnimating.value) return
  allowTransition.value = true
  dragOffset.value = 0
  isAnimating.value = true
  trackPosition.value -= 1
  const prevIndex =
    (currentIndex.value - 1 + slides.value.length) % slides.value.length
  currentIndex.value = prevIndex
}

const finishTransitionIfNeeded = () => {
  if (!hasRealSlides.value) {
    isAnimating.value = false
    return
  }

  const total = slides.value.length
  if (trackPosition.value === 0) {
    allowTransition.value = false
    trackPosition.value = total
    requestAnimationFrame(() => {
      allowTransition.value = true
    })
  } else if (trackPosition.value === total + 1) {
    allowTransition.value = false
    trackPosition.value = 1
    requestAnimationFrame(() => {
      allowTransition.value = true
    })
  }

  isAnimating.value = false
}

const pointerThreshold = computed(() => Math.min(160, containerWidth.value * 0.25 || 160))

const resetDragState = () => {
  dragOffset.value = 0
  isDragging.value = false
  isPointerDown.value = false
  pointerId.value = null
}

const handlePointerDown = (event) => {
  if (isModalOpen.value) return
  resetCursorTimer()
  isPointerDown.value = true
  pointerId.value = event.pointerId
  dragStartX.value = event.clientX
  dragOffset.value = 0
  isDragging.value = false
  allowTransition.value = false
  if (event.currentTarget && event.currentTarget.setPointerCapture) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

const handlePointerMove = (event) => {
  if (!isPointerDown.value || isModalOpen.value) return
  const deltaX = event.clientX - dragStartX.value
  if (!isDragging.value && Math.abs(deltaX) > 10) {
    isDragging.value = true
  }
  if (isDragging.value) {
    dragOffset.value = deltaX
  }
}

const triggerNavigationForDrag = (deltaX) => {
  if (!hasRealSlides.value) return false
  if (Math.abs(deltaX) < pointerThreshold.value) {
    allowTransition.value = true
    dragOffset.value = 0
    return false
  }
  if (deltaX < 0) {
    goNext()
  } else {
    goPrev()
  }
  return true
}

const handlePointerUp = (event) => {
  if (!isPointerDown.value) return
  if (event.currentTarget && event.currentTarget.releasePointerCapture && pointerId.value !== null) {
    event.currentTarget.releasePointerCapture(pointerId.value)
  }
  const deltaX = event.clientX - dragStartX.value
  const navigated = isDragging.value ? triggerNavigationForDrag(deltaX) : false
  if (!isDragging.value && !navigated && !isModalOpen.value) {
    openModal()
  }
  if (!navigated) {
    allowTransition.value = true
    dragOffset.value = 0
  }
  resetDragState()
  resetCursorTimer()
}

const handlePointerCancel = (event) => {
  if (!isPointerDown.value) return
  if (event.currentTarget && event.currentTarget.releasePointerCapture && pointerId.value !== null) {
    event.currentTarget.releasePointerCapture(pointerId.value)
  }
  allowTransition.value = true
  dragOffset.value = 0
  resetDragState()
  resetCursorTimer()
}

const handlePointerLeave = (event) => {
  if (!isPointerDown.value) return
  handlePointerUp(event)
}

const handleKeydown = (event) => {
  if (event.repeat) return
  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault()
      if (!isModalOpen.value) goNext()
      break
    case 'ArrowLeft':
      event.preventDefault()
      if (!isModalOpen.value) goPrev()
      break
    case 'Enter':
      event.preventDefault()
      if (isModalOpen.value) {
        confirmStart()
      } else {
        openModal()
      }
      break
    case 'Escape':
      if (isModalOpen.value) {
        event.preventDefault()
        closeModal()
      }
      break
    default:
      break
  }
}

const preloadCache = new Set()
watch(
  () => [currentIndex.value, hasRealSlides.value],
  () => {
    if (!hasRealSlides.value) return
    const total = slides.value.length
    const indices = [
      currentIndex.value,
      (currentIndex.value + 1) % total,
      (currentIndex.value - 1 + total) % total,
    ]
    indices.forEach((idx) => {
      const slide = slides.value[idx]
      if (slide?.type === 'image' && !preloadCache.has(slide.src)) {
        const img = new Image()
        img.src = slide.src
        preloadCache.add(slide.src)
      }
    })
  },
  { immediate: true }
)

onMounted(() => {
  updateBounds()
  window.addEventListener('resize', updateBounds)
  window.addEventListener('keydown', handleKeydown)
  resetCursorTimer()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateBounds)
  window.removeEventListener('keydown', handleKeydown)
  if (cursorTimer) {
    clearTimeout(cursorTimer)
  }
})
</script>

<template>
  <div
    ref="carouselRoot"
    class="home-screen"
    :class="{ 'cursor-hidden': cursorHidden }"
    tabindex="-1"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerCancel"
    @pointerleave="handlePointerLeave"
  >
    <div class="carousel-track-wrapper">
      <div
        class="carousel-track"
        :style="trackStyle"
        @transitionend="finishTransitionIfNeeded"
      >
        <div
          v-for="(slide, index) in trackSlides"
          :key="slide.id ?? `slide-${index}`"
          class="carousel-slide"
          :class="{
            'is-placeholder': slide.type === 'placeholder',
            'is-active': slide.id === activeSlideId,
          }"
        >
          <img
            v-if="slide.type === 'image'"
            :src="slide.src"
            :alt="slide.alt"
            draggable="false"
          />
          <div v-else class="carousel-placeholder">
            <div class="placeholder-copy">
              <h1>No promos available</h1>
              <p>Stay tuned for upcoming campaigns.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <teleport to="body">
      <div
        v-if="isModalOpen"
        class="modal-backdrop"
        role="presentation"
        @click="closeModal"
      >
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-modal-title"
          @click.stop
        >
          <h2 id="start-modal-title">Start the photo?</h2>
          <div class="modal-actions">
            <button type="button" class="modal-btn primary" @click="confirmStart">
              Yes
            </button>
            <button type="button" class="modal-btn secondary" @click="closeModal">
              No
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.home-screen {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  align-items: stretch;
  justify-content: center;
  color: #fff;
}

.home-screen.cursor-hidden {
  cursor: none;
}

.carousel-track-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.carousel-track {
  width: 100%;
  height: 100%;
  display: flex;
}

.carousel-slide {
  position: relative;
  width: 100%;
  height: 100%;
  flex: 0 0 100%;
}

.carousel-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.carousel-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #121212, #2b2b2b);
  text-align: center;
  padding: 2rem;
}

.placeholder-copy h1 {
  font-size: clamp(2.5rem, 6vw, 4rem);
  margin: 0 0 1rem;
}

.placeholder-copy p {
  font-size: clamp(1.2rem, 3vw, 2rem);
  margin: 0;
  opacity: 0.8;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 20;
  backdrop-filter: blur(4px);
}

.modal {
  background: rgba(12, 16, 24, 0.95);
  border-radius: 32px;
  padding: clamp(2rem, 5vw, 3rem);
  text-align: center;
  color: #fff;
  min-width: min(36rem, 90vw);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
}

.modal h2 {
  font-size: clamp(2.2rem, 5vw, 3rem);
  margin: 0 0 2rem;
  font-weight: 700;
}

.modal-actions {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.modal-btn {
  min-width: 10rem;
  padding: 1rem 2.5rem;
  font-size: clamp(1.5rem, 3.2vw, 2rem);
  font-weight: 600;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.modal-btn.primary {
  background: #ff002b;
  color: #fff;
  box-shadow: 0 16px 32px rgba(255, 0, 43, 0.35);
}

.modal-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.35);
}

.modal-btn:hover,
.modal-btn:focus-visible {
  transform: translateY(-2px) scale(1.02);
  outline: none;
}

.modal-btn:active {
  transform: translateY(0);
}

@media (orientation: landscape) {
  .home-screen {
    max-width: 1080px;
    margin: 0 auto;
  }
}
</style>
