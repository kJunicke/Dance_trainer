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
  background: var(--color-aubergine);
}

.user {
  font-size: 14px;
  color: var(--color-text-on-aubergine);
}

.signout-btn {
  padding: 6px 12px;
  border: 1px solid var(--color-brass);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-on-aubergine);
  font-size: 13px;
  cursor: pointer;
}

.signout-btn:hover {
  background: var(--color-aubergine-light);
}

.boards {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px;
}

h1 {
  font-family: var(--font-display);
  font-style: italic;
  font-variation-settings: 'WONK' 1;
  font-weight: 600;
  font-size: 26px;
  color: var(--color-text-on-aubergine);
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
  border: 1px solid var(--color-brass-light);
  border-radius: var(--radius-sm);
  background: var(--color-parquet-light);
  color: var(--color-ink);
  font-size: 15px;
}

.create button {
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-brass);
  color: var(--color-text-on-brass);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.create button:hover {
  background: var(--color-brass-light);
}

.join button {
  background: var(--color-sage);
  color: var(--color-text-on-aubergine);
}

.join button:hover {
  background: #7fa07c;
}

.status {
  font-size: 14px;
  color: var(--color-text-on-aubergine);
}

.status.error {
  color: var(--color-rose-light);
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
  background: var(--color-parquet);
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
  background: var(--color-parquet-light);
}

.delete {
  margin-right: 8px;
  padding: 8px 12px;
  border: 1px solid var(--color-rose);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-rose);
  font-size: 13px;
  cursor: pointer;
}

.delete:hover {
  background: #f7e6e8;
}
</style>
