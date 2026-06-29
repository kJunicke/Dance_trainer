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
  background: #c3ccd6;
}

.user {
  font-size: 14px;
  color: #333;
}

.signout-btn {
  padding: 6px 12px;
  border: 1px solid #888;
  border-radius: 6px;
  background: transparent;
  color: #333;
  font-size: 13px;
  cursor: pointer;
}

.signout-btn:hover {
  background: #b3bdc8;
}

.boards {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px;
}

h1 {
  font-size: 20px;
  color: #333;
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
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 15px;
}

.create button {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: #6b8cae;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.join button {
  background: #5a9e7a;
}

.status {
  font-size: 14px;
  color: #666;
}

.status.error {
  color: #c00;
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
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.name {
  flex: 1;
  text-align: left;
  padding: 14px 16px;
  border: none;
  background: transparent;
  font-size: 16px;
  color: #333;
  cursor: pointer;
}

.name:hover {
  background: #eef2f6;
}

.delete {
  margin-right: 8px;
  padding: 8px 12px;
  border: 1px solid #d99;
  border-radius: 6px;
  background: transparent;
  color: #c00;
  font-size: 13px;
  cursor: pointer;
}

.delete:hover {
  background: #fbeaea;
}
</style>
