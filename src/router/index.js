import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../pages/HomeScreen.vue'),
  },
  {
    path: '/photo-session',
    name: 'photo-session',
    component: () => import('../pages/PhotoSession.vue'),
  },
  {
    path: '/result',
    name: 'result',
    component: () => import('../pages/ResultDisplay.vue'),
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
