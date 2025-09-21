// Variables globales
let barberiaConfig = null;
let barberos = [];
let selectedBarbero = null;
let servicesContainer = null;
let dateInput = null;
let availableHoursList = null;
let barberoIdInput = null;
let serviceInput = null;
let timeInput = null;
let nextBtn = null;
let prevBtn = null;

// Funciones globales
function resetTimeSelection() {
    if (timeInput) timeInput.value = '';
    document.querySelectorAll('#available-hours-list li').forEach(item => {
        item.classList.remove('selected');
    });
    if (nextBtn) nextBtn.disabled = true;
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


function convertToAMPM(hour) {
    const [h, m] = hour.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const newHours = hours % 12 || 12;
    return `${newHours}:${m} ${ampm}`;
}

// Función para renderizar barberos (mover al ámbito global)
function renderBarberos() {
    const professionalsContainer = document.getElementById('professionals-container');
    if (!professionalsContainer) return;

    // Limpiar el contenedor
    professionalsContainer.innerHTML = '';

    // Crear cards de barberos dinámicamente
    barberos.forEach(barbero => {
        const professionalCard = document.createElement('div');
        professionalCard.classList.add('professional-card');
        professionalCard.dataset.professional = barbero.id;
        professionalCard.innerHTML = `
            <img src="img/ima.png" alt="${barbero.nombre}">
            <h3>${barbero.nombre}</h3>
            <p>${barbero.especialidad || 'Profesional de la belleza'}</p>
        `;
        
        professionalCard.addEventListener('click', () => {
            document.querySelectorAll('.professional-card').forEach(c => c.classList.remove('selected'));
            professionalCard.classList.add('selected');
            selectedBarbero = barbero;
            document.getElementById('barbero_id').value = barbero.id;
            document.getElementById('next-btn').disabled = false;
        });
        
        professionalsContainer.appendChild(professionalCard);
    });
}

// Función para obtener parámetro barbería de la URL
function getBarberiaParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const barberia = urlParams.get('barberia');
    console.log('Parámetro barbería detectado:', barberia);
    return barberia;
}

// FunciÃ³n para agregar parÃ¡metro barberÃ­a a las URLs de API
function buildApiUrl(endpoint) {
    const barberia = getBarberiaParam();
    if (barberia) {
        const separator = endpoint.includes('?') ? '&' : '?';
        return `${endpoint}${separator}barberia=${barberia}`;
    }
    return endpoint;
}

// Modificar la funciÃ³n loadBarberiaConfig
async function loadBarberiaConfig() {
    try {
        const url = buildApiUrl('/api/barberia/config');
        console.log('Llamando a:', url);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error cargando configuraciÃ³n');
        
        barberiaConfig = await response.json();
        console.log('ConfiguraciÃ³n cargada:', barberiaConfig);
        
        // Aplicar tema visual
        if (barberiaConfig.colores_tema) {
            applyBarberiaTheme(barberiaConfig.colores_tema);
        }
        
        // Actualizar informaciÃ³n visual
        updateBarberiaInfo(barberiaConfig);
        
    } catch (error) {
        console.error('Error cargando configuraciÃ³n de barberÃ­a:', error);
    }
}

// Modificar la funciÃ³n loadBarberos
async function loadBarberos() {
    try {
        const url = buildApiUrl('/api/barberos');
        console.log('Llamando a:', url);
        
        const response = await fetch(url);
        barberos = await response.json();
        
        if (barberos.length === 0) {
            console.error('No hay barberos disponibles');
            return;
        }

        renderBarberos();
    } catch (error) {
        console.error('Error cargando barberos:', error);
        // Fallback con datos por defecto si falla la API
        barberos = [
            { id: 1, nombre: 'Giovany', especialidad: 'Especialista en cortes masculinos' },
            { id: 2, nombre: 'Danitza', especialidad: 'Especialista en tratamientos capilares' }
        ];
        renderBarberos();
    }
}

// Modificar la funciÃ³n updateAvailableTimeSlots
// REEMPLAZAR la función updateAvailableTimeSlots en index.js con esta versión:

// Función updateAvailableTimeSlots modificada para soportar horarios especiales
async function updateAvailableTimeSlots() {
    const selectedDate = dateInput.value;
    const selectedBarberoId = barberoIdInput.value;
    
    resetTimeSelection();

    if (!selectedDate || !selectedBarberoId) return;

    availableHoursList.innerHTML = '<li class="loading-indicator">Cargando horas disponibles...</li>';
    
    try {
        // PASO 1: Verificar si hay horario especial para esta fecha
        const horarioEspecialUrl = buildApiUrl(`/api/horarios/fecha/${selectedDate}?barbero_id=${selectedBarberoId}`);
        console.log('Verificando horario especial:', horarioEspecialUrl);
        
        const horarioEspecialResponse = await fetch(horarioEspecialUrl);
        
        let selectedDaySlots = [];
        
        if (horarioEspecialResponse.ok) {
            const horarioData = await horarioEspecialResponse.json();
            console.log('Respuesta horario especial:', horarioData);
            
            if (horarioData.tipo === 'especial') {
                // Usar horario especial
                if (horarioData.dia_no_laboral) {
                    availableHoursList.innerHTML = '<li>No hay atención este día (horario especial configurado).</li>';
                    return;
                }
                
                // Combinar horarios de mañana y tarde del horario especial
                selectedDaySlots = [
                    ...(horarioData.horario_manana || []),
                    ...(horarioData.horario_tarde || [])
                ];
                
                console.log('Usando horario especial:', selectedDaySlots);
            } else {
                // Usar horario por defecto - llamar a la API existente
                console.log('No hay horario especial, usando horario por defecto');
                const scheduleUrl = buildApiUrl(`/api/barberos/${selectedBarberoId}/horario-defecto?fecha=${selectedDate}`);
                const defaultScheduleResponse = await fetch(scheduleUrl);
                
                if (defaultScheduleResponse.ok) {
                    const defaultSchedule = await defaultScheduleResponse.json();
                    
                    if (defaultSchedule.dia_no_laboral) {
                        availableHoursList.innerHTML = '<li>No hay atención este día.</li>';
                        return;
                    }
                    
                    selectedDaySlots = [
                        ...(defaultSchedule.horario_manana || []),
                        ...(defaultSchedule.horario_tarde || [])
                    ];
                } else {
                    throw new Error('No se pudo obtener horario por defecto');
                }
            }
        } else {
            // Si falla la consulta de horario especial, usar horario por defecto como fallback
            console.log('Error consultando horario especial, usando horario por defecto como fallback');
            const scheduleUrl = buildApiUrl(`/api/barberos/${selectedBarberoId}/horario-defecto?fecha=${selectedDate}`);
            const defaultScheduleResponse = await fetch(scheduleUrl);
            
            if (defaultScheduleResponse.ok) {
                const defaultSchedule = await defaultScheduleResponse.json();
                
                if (defaultSchedule.dia_no_laboral) {
                    availableHoursList.innerHTML = '<li>No hay atención este día.</li>';
                    return;
                }
                
                selectedDaySlots = [
                    ...(defaultSchedule.horario_manana || []),
                    ...(defaultSchedule.horario_tarde || [])
                ];
            } else {
                throw new Error('No se pudo obtener ningún horario');
            }
        }

        // PASO 2: Convertir a formato AM/PM para mostrar
        selectedDaySlots = selectedDaySlots.map(convertToAMPM);

        // PASO 3: Obtener citas ya reservadas
        const appointmentsUrl = buildApiUrl(`/api/appointments/filter?date=${selectedDate}&barbero_id=${selectedBarberoId}`);
        console.log('Consultando citas reservadas:', appointmentsUrl);
        
        const response = await fetch(appointmentsUrl);
        const bookedAppointments = await response.json();
        const bookedTimes = bookedAppointments.map(appointment => convertToAMPM(appointment.hora));

        // PASO 4: Filtrar horarios disponibles
        const remainingSlots = selectedDaySlots.filter(slot => !bookedTimes.includes(slot));

        // PASO 5: Renderizar slots disponibles
        availableHoursList.innerHTML = '';
        
        if (remainingSlots.length === 0) {
            availableHoursList.innerHTML = '<li>No hay horarios disponibles para esta fecha.</li>';
        } else {
            remainingSlots.forEach(slot => {
                const listItem = document.createElement('li');
                listItem.textContent = slot;
                listItem.addEventListener('click', () => {
                    const [time, period] = slot.split(' ');
                    let [hours, minutes] = time.split(':');
                    hours = parseInt(hours);
                    
                    if (period === 'PM' && hours !== 12) hours += 12;
                    if (period === 'AM' && hours === 12) hours = 0;
                    
                    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
                    timeInput.value = formattedTime;
                    
                    document.querySelectorAll('#available-hours-list li').forEach(item => 
                        item.classList.remove('selected'));
                    listItem.classList.add('selected');
                    nextBtn.disabled = false;
                });
                availableHoursList.appendChild(listItem);
            });
        }
        
    } catch (error) {
        console.error('Error completo:', error);
        // Fallback completo en caso de error
        const fallbackSlots = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map(convertToAMPM);
        
        availableHoursList.innerHTML = '';
        fallbackSlots.forEach(slot => {
            const listItem = document.createElement('li');
            listItem.textContent = slot;
            listItem.addEventListener('click', () => {
                const [time, period] = slot.split(' ');
                let [hours, minutes] = time.split(':');
                hours = parseInt(hours);
                
                if (period === 'PM' && hours !== 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;
                
                const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
                timeInput.value = formattedTime;
                
                document.querySelectorAll('#available-hours-list li').forEach(item => 
                    item.classList.remove('selected'));
                listItem.classList.add('selected');
                nextBtn.disabled = false;
            });
            availableHoursList.appendChild(listItem);
        });
    }
}

// Modificar la funciÃ³n updateServices
async function updateServices() {
    if (!selectedBarbero) return;

    servicesContainer.innerHTML = '<div class="loading">Cargando servicios...</div>';
    
    try {
        const url = buildApiUrl(`/api/barberos/${selectedBarbero.id}/servicios`);
        console.log('Llamando a servicios:', url);
        
        const response = await fetch(url);
        const servicios = await response.json();
        
        servicesContainer.innerHTML = '';
        servicios.forEach(service => {
            const serviceCard = document.createElement('div');
            serviceCard.classList.add('service-card');
            serviceCard.dataset.service = service.value;
            serviceCard.innerHTML = `
                <img src="${service.image}" alt="${service.text}">
                <h3>${service.text}</h3>
            `;
            serviceCard.addEventListener('click', () => {
                document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
                serviceCard.classList.add('selected');
                serviceInput.value = service.value;
                nextBtn.disabled = false;
            });
            servicesContainer.appendChild(serviceCard);
        });
    } catch (error) {
        console.error('Error cargando servicios:', error);
        servicesContainer.innerHTML = '<div class="error">Error cargando servicios. Intente nuevamente.</div>';
    }
}

// Modificar tambiÃ©n checkExistingAppointmentSameDay
async function checkExistingAppointmentSameDay(appointment) {
    try {
        const url = buildApiUrl(`/api/appointments/filter?date=${appointment.fecha}&barbero_id=${appointment.barbero_id}`);
        console.log('Verificando citas existentes:', url);
        
        const res = await fetch(url);
        const appointments = await res.json();
        const sameUserAppointments = appointments.filter(app => app.telefono === appointment.telefono);

        if (sameUserAppointments.length > 0) {
            return sameUserAppointments[0].hora;
        }
        return null;
    } catch (error) {
        console.error("Error verificando citas existentes:", error);
        return null;
    }
}

// Modificar la llamada de crear cita tambiÃ©n
// En renderFinalConfirmationModal, cambiar la llamada fetch a:
// fetch(buildApiUrl('/api/appointments'), {

function applyBarberiaTheme(colores) {
    const root = document.documentElement;
    
    if (colores.primario) {
        root.style.setProperty('--primary-purple', colores.primario);
    }
    if (colores.secundario) {
        root.style.setProperty('--secondary-purple', colores.secundario);
    }
}

function updateBarberiaInfo(config) {
    // Actualizar tÃ­tulo de pÃ¡gina
    document.title = `${config.nombre} - Reserva tu Cita`;
    
    // Actualizar logo si existe
    const logoElements = document.querySelectorAll('.app-header img');
    logoElements.forEach(logo => {
        if (config.logo_url) {
            logo.src = config.logo_url;
        }
        logo.alt = `${config.nombre} Logo`;
    });
    
    // Actualizar cualquier texto de nombre de barberÃ­a
    const nameElements = document.querySelectorAll('.barberia-name');
    nameElements.forEach(el => el.textContent = config.nombre);
}

// Funciones globales de formateo
function formatDate(dateString) {
    if (!dateString) return 'Fecha no vÃ¡lida';
    
    const date = new Date(dateString);
    if (isNaN(date)) return 'Fecha no vÃ¡lida';

    date.setDate(date.getDate() + 1);
    return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function formatTime(timeString) {
    const [hour, minute] = timeString.split(':');
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleString('es-ES', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
}

// CAMBIO AQUÃ: Hacer la funciÃ³n async
// CAMBIO AQUÍ: Hacer la función async
document.addEventListener('DOMContentLoaded', async function() {
    // PRIMERO cargar configuración de barbería
    await loadBarberiaConfig();

    const steps = document.querySelectorAll('.booking-step');
    const progressSteps = document.querySelectorAll('.step');
    prevBtn = document.getElementById('prev-btn');
    nextBtn = document.getElementById('next-btn');
    let currentStep = 0;



    // Elementos del DOM - ASIGNAR A VARIABLES GLOBALES
    dateInput = document.getElementById('date');
    availableHoursList = document.getElementById('available-hours-list');
    servicesContainer = document.getElementById('services-container');

    // Inputs ocultos
    barberoIdInput = document.createElement('input');
    barberoIdInput.type = 'hidden';
    barberoIdInput.id = 'barbero_id';
    document.body.appendChild(barberoIdInput);

    serviceInput = document.createElement('input');
    serviceInput.type = 'hidden';
    serviceInput.id = 'service';
    document.body.appendChild(serviceInput);

    timeInput = document.createElement('input');
    timeInput.type = 'hidden';
    timeInput.id = 'time';
    document.body.appendChild(timeInput);

    // Configurar fechas mínima y máxima
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${year}-${month}-${day}`;
    
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(today.getMonth() + 1);
    const maxYear = oneMonthLater.getFullYear();
    const maxMonth = String(oneMonthLater.getMonth() + 1).padStart(2, '0');
    const maxDay = String(oneMonthLater.getDate()).padStart(2, '0');
    dateInput.max = `${maxYear}-${maxMonth}-${maxDay}`;
    
    dateInput.addEventListener('change', () => {
        const selectedDate = new Date(dateInput.value + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const oneMonthLater = new Date(today);
        oneMonthLater.setMonth(today.getMonth() + 1);
        oneMonthLater.setHours(23, 59, 59, 999);
    
        if (selectedDate < today || selectedDate > oneMonthLater) {
            alert('Selecciona una fecha válida entre hoy y un mes a partir de hoy.');
            dateInput.value = '';
        }
    });



    // Event listeners
    dateInput.addEventListener('change', () => {
        validateStep();
        updateAvailableTimeSlots();
    });

    // Validación de pasos
    function validateStep() {
        switch(currentStep) {
            case 0: // Professional
                const selectedProfessional = document.querySelector('.professional-card.selected');
                nextBtn.disabled = !selectedProfessional;
                return !!selectedProfessional;
            case 1: // Service
                const selectedService = document.querySelector('.service-card.selected');
                nextBtn.disabled = !selectedService;
                return !!selectedService;
            case 2: // Personal Data
                const name = document.getElementById('name').value.trim();
                const surname = document.getElementById('surname').value.trim();
                const phone = document.getElementById('phone').value.trim();
                
                const nameError = document.getElementById('name-error');
                const surnameError = document.getElementById('surname-error');
                const phoneError = document.getElementById('phone-error');
                
                let isValid = true;

                // Validación de nombre
                if (!name) {
                    nameError.textContent = 'Nombre es requerido';
                    isValid = false;
                } else if (name.length < 2) {
                    nameError.textContent = 'Nombre debe tener al menos 2 caracteres';
                    isValid = false;
                } else {
                    nameError.textContent = '';
                }

                // Validación de apellido
                if (!surname) {
                    surnameError.textContent = 'Apellido es requerido';
                    isValid = false;
                } else if (surname.length < 2) {
                    surnameError.textContent = 'Apellido debe tener al menos 2 caracteres';
                    isValid = false;
                } else {
                    surnameError.textContent = '';
                }

                // Validación de teléfono
                const phoneRegex = /^[3-7][0-9]{9}$/;
                if (!phone) {
                    phoneError.textContent = 'Teléfono es requerido';
                    isValid = false;
                } else if (!phoneRegex.test(phone)) {
                    phoneError.textContent = 'Teléfono inválido (10 dígitos, comienza con 3-7)';
                    isValid = false;
                } else {
                    phoneError.textContent = '';
                }

                nextBtn.disabled = !isValid;
                return isValid;
            case 3: // Date and Time
                const hasDate = dateInput.value;
                const hasTime = timeInput.value;
                nextBtn.disabled = !(hasDate && hasTime);
                return hasDate && hasTime;
            case 4: // Confirmation
                nextBtn.disabled = false;
                return true;
            default:
                return true;
        }
    }

    // Navegación
    prevBtn.addEventListener('click', () => {
        if (currentStep > 0) {
            steps[currentStep].classList.remove('active');
            currentStep--;
            steps[currentStep].classList.add('active');
            
            if (currentStep === 3) {
                resetTimeSelection();
            }
            
            scrollToTop();
            updateProgressSteps();
            updateNavigationButtons();
            updateCheckStatusButtonVisibility();
            validateStep();
        }
    });

    // Event listeners para validación en tiempo real
    document.getElementById('name').addEventListener('input', validateStep);
    document.getElementById('surname').addEventListener('input', validateStep);
    document.getElementById('phone').addEventListener('input', validateStep);

    function updateProgressSteps() {
        progressSteps.forEach((step, index) => {
            step.classList.toggle('active', index <= currentStep);
        });
    }

    function updateNavigationButtons() {
        prevBtn.style.display = currentStep > 0 ? 'block' : 'none';
        nextBtn.textContent = currentStep === 4 ? 'Siguiente' : 'Siguiente';
    }

    function updateCheckStatusButtonVisibility() {
        const checkStatusButton = document.getElementById('check-status-button');
        const checkStatusContainer = document.querySelector('.check-status-container');
        if (checkStatusContainer) {
            checkStatusContainer.style.display = currentStep === 0 ? 'block' : 'none';
        }
    }

    nextBtn.addEventListener('click', () => {
        if (validateStep()) {
            const appointment = {
                nombre: document.getElementById('name').value,
                apellido: document.getElementById('surname').value,
                telefono: document.getElementById('phone').value,
                fecha: dateInput.value,
                hora: timeInput.value,
                servicio: serviceInput.value,
                barbero_id: barberoIdInput.value,
            };
            
            if (currentStep === 4) {
                showConfirmationModal(appointment);
                return;
            }
            
            const confirmationDetails = document.getElementById('confirmation-details');
            if (currentStep === 3) {
                confirmationDetails.innerHTML = `
                    <p><strong>Profesional:</strong> <span id="confirm-professional">${selectedBarbero.nombre}</span></p>
                    <p><strong>Servicio:</strong> <span id="confirm-service">${appointment.servicio}</span></p>
                    <p><strong>Nombre:</strong> <span id="confirm-name">${appointment.nombre} ${appointment.apellido}</span></p>
                    <p><strong>Teléfono:</strong> <span id="confirm-phone">${appointment.telefono}</span></p>
                    <p><strong>Fecha:</strong> <span id="confirm-date">${formatDate(appointment.fecha)}</span></p>
                    <p><strong>Hora:</strong> <span id="confirm-time">${formatTime(appointment.hora)}</span></p>
                `;
            }
            
            if (currentStep === 0) updateServices();
    
            steps[currentStep].classList.remove('active');
            currentStep++;
            steps[currentStep].classList.add('active');
            
            scrollToTop();
            
            updateProgressSteps();
            updateNavigationButtons();
            updateCheckStatusButtonVisibility();
            nextBtn.disabled = !validateStep();
        }
    });

    // Modal de confirmación
    async function showConfirmationModal(appointment) {
        // Verificar si ya tiene cita el mismo día
        const horaExistente = await checkExistingAppointmentSameDay(appointment);
    
        if (horaExistente) {
            const modalHTML = `
                <div id="existing-appointment-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;
                    background-color:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;
                    z-index:9999;animation:fadeIn 0.3s ease-in;">
                    <div style="background:#1c1c1c;padding:2rem;border-radius:12px;
                        max-width:400px;width:90%;color:white;text-align:center;animation:slideIn 0.4s ease-out;">
                        <h2 style="color:#facc15;font-size:1.5rem;margin-bottom:1rem;">
                            Ya tienes una cita el ${formatDate(appointment.fecha)}
                        </h2>
                        <p style="margin-bottom:1.5rem;">
                            A las <strong>${formatTime(horaExistente)}</strong>. ¿Quieres agendar otra?
                        </p>
                        <div style="display:flex;gap:1rem;justify-content:center;">
                            <button id="cancel-existing" style="background:#f44336;padding:0.6rem 1.5rem;border:none;border-radius:8px;color:white;cursor:pointer;">No</button>
                            <button id="continue-existing" style="background:#4caf50;padding:0.6rem 1.5rem;border:none;border-radius:8px;color:white;cursor:pointer;">Sí</button>
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                </style>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            document.getElementById('cancel-existing').addEventListener('click', () => {
                document.getElementById('existing-appointment-modal').remove();
            });

            document.getElementById('continue-existing').addEventListener('click', () => {
                document.getElementById('existing-appointment-modal').remove();
                renderFinalConfirmationModal(appointment);
            });
        } else {
            renderFinalConfirmationModal(appointment);
        }
    }
    
    // Modal final de confirmación
    function renderFinalConfirmationModal(appointment) {
        const confirmationHTML = `
            <div id="confirmation-modal">
                <div>
                    <h2>Confirmar Cita</h2>
                    <p>¿Estás seguro de que deseas agendar esta cita?</p>
                    <div style="text-align: left; margin: 20px 0;">
                        <p>📅 Fecha: ${formatDate(appointment.fecha)}</p>
                        <p>⏰ Hora: ${formatTime(appointment.hora)}</p>
                        <p>💁 Barbero: ${selectedBarbero.nombre}</p>
                        <p>✂️ Servicio: ${appointment.servicio}</p>
                    </div>
                    <div>
                        <button id="cancel-booking">Cancelar</button>
                        <button id="confirm-booking">Confirmar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', confirmationHTML);

        const confirmModal = document.getElementById('confirmation-modal');
        const cancelButton = document.getElementById('cancel-booking');
        const confirmButton = document.getElementById('confirm-booking');

        cancelButton.addEventListener('click', () => {
            confirmModal.remove();
        });

        confirmButton.addEventListener('click', () => {
            confirmModal.remove();

            // Lógica de máximo 2 citas en 24 horas
            const currentTime = new Date().getTime();
            let previousBookings = JSON.parse(localStorage.getItem('previousBookings') || '[]');

            previousBookings = previousBookings.filter(time => {
                return (currentTime - time) <= (24 * 60 * 60 * 1000);
            });

            previousBookings.push(currentTime);
            localStorage.setItem('previousBookings', JSON.stringify(previousBookings));

            // Llamada al backend con buildApiUrl
            fetch(buildApiUrl('/api/appointments'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appointment)
            })
            .then(response => {
                if (response.ok) {
                    localStorage.setItem('lastBookingTime', currentTime.toString());
                    
                    // Usar la función global showSuccessModal de Agendar.js
                    if (typeof showSuccessModal === 'function') {
                        showSuccessModal(appointment);
                    } else {
                        // Fallback si la función no está disponible
                        alert('¡Cita agendada exitosamente!');
                        window.location.reload();
                    }
                    
                    // Resetear flujo
                    resetBookingFlow();
                    
                } else {
                    response.json().then(data => {
                        alert(data.message || 'Error al agendar la cita');
                    }).catch(() => {
                        alert('Error al agendar la cita');
                    });
                }
            })
            .catch(error => {
                console.error('Error al agendar:', error);
                alert('Hubo un problema al agendar la cita.');
            });
        });
    }

    // Función para resetear el flujo de reserva
    function resetBookingFlow() {
        steps[currentStep].classList.remove('active');
        currentStep = 0;
        steps[currentStep].classList.add('active');
        updateProgressSteps();
        updateNavigationButtons();
        updateCheckStatusButtonVisibility();
        
        // Limpiar formularios
        document.getElementById('name').value = '';
        document.getElementById('surname').value = '';
        document.getElementById('phone').value = '';
        dateInput.value = '';
        timeInput.value = '';
        
        // Remover selecciones
        document.querySelectorAll('.professional-card.selected').forEach(card => 
            card.classList.remove('selected'));
        document.querySelectorAll('.service-card.selected').forEach(card => 
            card.classList.remove('selected'));
        
        selectedBarbero = null;
        barberoIdInput.value = '';
        serviceInput.value = '';
    }

    // Verificar que el contenedor existe
    const professionalsContainer = document.getElementById('professionals-container');
    if (!professionalsContainer) {
        console.error('No se encontró el contenedor de profesionales');
        return;
    }
    
    // Inicialización
    await loadBarberos();
    updateCheckStatusButtonVisibility();
    nextBtn.disabled = true;
});