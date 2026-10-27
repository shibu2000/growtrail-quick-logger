export const SIGNIN_PATH = '/auth/signin'

export const sel = {
  loggedInMarker: 'a[href="/task/list"]',
  currentUserName: '.user-name-text',

  taskList: {
    heading: 'h4:has-text("Tasks List")',
    createTaskButton: 'button.add-btn',
    timelogItems: 'table tbody li.View[data-bs-original-title="Timelog"]',
    timelogButton: (taskId: string) =>
      `table tbody li.View[data-id="${taskId}"][data-bs-original-title="Timelog"] a.view-item-btn`,
  },

  createTask: {
    modal: '#showTaskModal',
    modalShown: '#showTaskModal.show',
    form: '#showTaskModal form[action="/task/form"]',
    field: (name: string) => `#showTaskModal [name="${name}"]`,
    select2Toggle: (field: string) => `#showTaskModal [aria-labelledby="select2-${field}-container"]`,
    followedBySearch: '#showTaskModal .select2-selection--multiple .select2-search__field',
    submit: '#showTaskModal button#add-btn[type="submit"]',
    close: '#showTaskModal .modal-footer button[data-bs-dismiss="modal"]',
  },

  select2: {
    openSearch: '.select2-container--open .select2-search__field',
    openOptions: '.select2-container--open li.select2-results__option',
  },

  timeLog: {
    modal: '#showTimelogModal',
    modalShown: '#showTimelogModal.show',
    form: '#showTimelogModal form[action="/task/time-log-add-update"]',
    field: (name: string) => `#showTimelogModal [name="${name}"]`,
    header: '#showTimelogModal label#taskId',
    spentSoFar: '#showTimelogModal label#spandTime',
    submit: '#showTimelogModal button#edit-btn[type="submit"]',
    close: '#showTimelogModal .modal-footer button[data-bs-dismiss="modal"]',
  },

  swal: {
    popup: '.swal2-popup.swal2-show',
    title: '.swal2-popup .swal2-title',
    confirm: '.swal2-popup .swal2-confirm',
  },
} as const

export const endpoints = {
  createTask: '/task/form',
  timeLogDetails: '/task/time-log-details',
  addTimeLog: '/task/time-log-add-update',
  taskDetails: '/task-details',
}

export const TIMELOG_SUCCESS_TEXT = 'Timelog created successfully.'
export const DEVTOOLS_WARNING_TEXT = 'Developer tools are open'
