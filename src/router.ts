import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/preparar' },
    {
      path: '/preparar',
      name: 'preparar',
      component: () => import('./views/PrepararView.vue'),
    },
    {
      path: '/despachar',
      name: 'despachar',
      component: () => import('./views/DespacharView.vue'),
    },
    {
      path: '/historial',
      name: 'historial',
      component: () => import('./views/HistorialView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/preparar' },
  ],
})

export default router
