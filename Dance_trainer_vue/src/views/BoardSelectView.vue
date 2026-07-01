<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '../stores/boardStore'
import { useAuthStore } from '../stores/authStore'

const store = useBoardStore()
const auth = useAuthStore()
const router = useRouter()

const newName = ref('')
const joinCode = ref('')
const importing = ref(false)
const importInput = ref<HTMLInputElement | null>(null)

onMounted(() => store.loadBoards())

async function signOut() {
  await auth.signOut()
  router.push({ name: 'login' })
}

function openBoard(id: number) {
  router.push({ name: 'board', params: { id } })
}

async function createBoard() {
  await store.createBoard(newName.value.trim() || 'New Board')
  newName.value = ''
}

function deleteBoard(id: number, name: string) {
  if (!window.confirm(`Delete "${name}"? This also deletes all its columns and cards.`)) return
  store.deleteBoard(id)
}

async function joinBoard() {
  const id = await store.joinBoard(joinCode.value.trim())
  if (id) {
    joinCode.value = ''
    router.push({ name: 'board', params: { id } })
  }
}

async function onImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  importing.value = true
  const id = await store.importTrelloBoard(file)
  importing.value = false
  if (importInput.value) importInput.value.value = ''
  if (id) router.push({ name: 'board', params: { id } })
}
</script>

<template>
  <header class="topbar">
    <span class="user">{{ auth.user?.user_metadata?.display_name || auth.user?.email }}</span>
    <button class="signout-btn" @click="signOut">Sign out</button>
  </header>

  <main class="boards">
    <h1>Your boards</h1>

    <form class="create" @submit.prevent="createBoard">
      <input v-model="newName" type="text" placeholder="New board name" />
      <button type="submit">Create</button>
    </form>

    <form class="create join" @submit.prevent="joinBoard">
      <input v-model="joinCode" type="text" placeholder="Paste an invite code to join" />
      <button type="submit">Join</button>
    </form>

    <div class="create">
      <button type="button" :disabled="importing" @click="importInput?.click()">
        {{ importing ? 'Importing…' : 'Import from Trello JSON' }}
      </button>
      <input
        ref="importInput"
        type="file"
        accept="application/json"
        class="file-input"
        @change="onImportFile"
      />
    </div>

    <p v-if="store.loading" class="status">Loading…</p>
    <p v-else-if="store.error" class="status error">{{ store.error }}</p>
    <p v-else-if="store.boards.length === 0" class="status">No boards yet — create one above.</p>

    <ul v-else class="list">
      <li v-for="b in store.boards" :key="b.id">
        <button class="name" @click="openBoard(b.id)">{{ b.name }}</button>
        <button class="delete" @click="deleteBoard(b.id, b.name)">Delete</button>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 24px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.user {
  font-size: 14px;
  color: var(--color-ink-dim);
}

.signout-btn {
  padding: 6px 12px;
  border: 1px solid var(--color-ember);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font-size: 13px;
  cursor: pointer;
}

.signout-btn:hover {
  background: var(--color-surface-light);
}

.boards {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px;
}

h1 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 26px;
  letter-spacing: -0.01em;
  color: var(--color-ink);
  margin-bottom: 16px;
}

.create {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.create input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 15px;
}

.create button {
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-ember);
  color: var(--color-text-on-ember);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.create button:hover {
  background: var(--color-ember-light);
}

.join button {
  background: var(--color-good);
  color: var(--color-text-on-ember);
}

.join button:hover {
  background: var(--color-good-light);
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.status {
  font-size: 14px;
  color: var(--color-ink-dim);
}

.status.error {
  color: var(--color-overdue);
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list li {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.name {
  flex: 1;
  text-align: left;
  padding: 14px 16px;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--color-ink);
  cursor: pointer;
}

.name:hover {
  background: var(--color-surface-light);
}

.delete {
  margin-right: 8px;
  padding: 8px 12px;
  border: 1px solid var(--color-overdue);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-overdue);
  font-size: 13px;
  cursor: pointer;
}

.delete:hover {
  background: color-mix(in srgb, var(--color-overdue) 12%, transparent);
}
</style>
