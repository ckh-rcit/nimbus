<script setup lang="ts">
const colorMode = useColorMode()
colorMode.preference = 'dark'
</script>

<template>
  <UApp :ui="{ root: 'bg-neutral-950' }">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
