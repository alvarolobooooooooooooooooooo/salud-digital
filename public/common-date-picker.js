/**
 * Calendar Datetime Picker
 */

function replaceWithCalendarDatetimePicker(input, options = {}) {
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '0.5rem';
  const getOccupiedHours = options.getOccupiedHours || (() => []);

  const today = new Date();
  let selectedYear = today.getFullYear();
  let selectedMonth = today.getMonth();
  let selectedDay = today.getDate();
  let selectedHour = today.getHours();
  let selectedMinute = today.getMinutes();

  const currentValue = input.value;
  if (currentValue) {
    const [datePart, timePart] = currentValue.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    selectedYear = year;
    selectedMonth = month - 1;
    selectedDay = day;
    selectedHour = hour;
    selectedMinute = minute;
  }

  // Update input function
  const updateInput = () => {
    const month = (selectedMonth + 1).toString().padStart(2, '0');
    const day = selectedDay.toString().padStart(2, '0');
    const hour = selectedHour.toString().padStart(2, '0');
    const minute = selectedMinute.toString().padStart(2, '0');
    input.value = `${selectedYear}-${month}-${day}T${hour}:${minute}`;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Calendar section
  const calContainer = document.createElement('div');
  calContainer.style.display = 'flex';
  calContainer.style.flexDirection = 'column';
  calContainer.style.gap = '0.4rem';
  calContainer.style.width = '100%';
  calContainer.style.padding = '0.75rem';
  calContainer.style.border = '1px solid #e2e8f0';
  calContainer.style.borderRadius = '6px';
  calContainer.style.backgroundColor = '#f9fafb';

  const calLabel = document.createElement('label');
  calLabel.textContent = 'Fecha';
  calLabel.style.fontSize = '.75rem';
  calLabel.style.fontWeight = '600';
  calLabel.style.color = '#374151';
  calLabel.style.marginBottom = '0.3rem';
  calContainer.appendChild(calLabel);

  const monthYearSpan = document.createElement('span');
  monthYearSpan.style.fontSize = '.8rem';
  monthYearSpan.style.fontWeight = '600';
  monthYearSpan.style.color = '#0f172a';
  monthYearSpan.style.textAlign = 'center';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '‹';
  prevBtn.style.background = 'none';
  prevBtn.style.border = 'none';
  prevBtn.style.color = '#475569';
  prevBtn.style.borderRadius = '6px';
  prevBtn.style.padding = '0.25rem 0.5rem';
  prevBtn.style.cursor = 'pointer';
  prevBtn.style.fontSize = '.8rem';
  prevBtn.type = 'button';

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '›';
  nextBtn.style.background = 'none';
  nextBtn.style.border = 'none';
  nextBtn.style.color = '#475569';
  nextBtn.style.borderRadius = '6px';
  nextBtn.style.padding = '0.25rem 0.5rem';
  nextBtn.style.cursor = 'pointer';
  nextBtn.style.fontSize = '.8rem';
  nextBtn.type = 'button';

  const navContainer = document.createElement('div');
  navContainer.style.display = 'flex';
  navContainer.style.alignItems = 'center';
  navContainer.style.justifyContent = 'center';
  navContainer.style.gap = '0.4rem';
  navContainer.style.marginBottom = '0.3rem';

  const calGrid = document.createElement('div');
  calGrid.style.display = 'grid';
  calGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
  calGrid.style.gap = '0.25rem';

  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DAY_SHORT = ['L','M','X','J','V','S','D'];

  const renderCalendar = () => {
    monthYearSpan.textContent = MONTH_NAMES[selectedMonth] + ' ' + selectedYear;
    calGrid.innerHTML = '';

    DAY_SHORT.forEach(d => {
      const header = document.createElement('div');
      header.textContent = d;
      header.style.textAlign = 'center';
      header.style.fontSize = '.7rem';
      header.style.fontWeight = '600';
      header.style.color = '#94a3b8';
      header.style.padding = '0.2rem 0';
      calGrid.appendChild(header);
    });

    const first = new Date(selectedYear, selectedMonth, 1);
    const last = new Date(selectedYear, selectedMonth + 1, 0);
    const startDay = (first.getDay() + 6) % 7;

    for (let i = 0; i < startDay; i++) {
      calGrid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= last.getDate(); d++) {
      const btn = document.createElement('button');
      btn.textContent = d;
      btn.type = 'button';
      btn.style.padding = '0.5rem';
      btn.style.border = '1px solid #f1f5f9';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '.85rem';
      btn.style.background = 'white';
      btn.style.color = '#475569';
      btn.style.fontWeight = d === selectedDay ? '700' : '500';
      btn.style.minHeight = '32px';

      if (d === selectedDay) {
        btn.style.background = '#0891b2';
        btn.style.color = 'white';
        btn.style.borderColor = '#0891b2';
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedDay = d;
        renderCalendar();
        renderTimeGrid();
        updateInput();
      });

      calGrid.appendChild(btn);
    }
  };

  prevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    selectedMonth--;
    if (selectedMonth < 0) {
      selectedMonth = 11;
      selectedYear--;
    }
    renderCalendar();
    renderTimeGrid();
  });

  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    selectedMonth++;
    if (selectedMonth > 11) {
      selectedMonth = 0;
      selectedYear++;
    }
    renderCalendar();
    renderTimeGrid();
  });

  navContainer.appendChild(prevBtn);
  navContainer.appendChild(monthYearSpan);
  navContainer.appendChild(nextBtn);
  calContainer.appendChild(navContainer);
  calContainer.appendChild(calGrid);

  // Time picker
  const timeContainer = document.createElement('div');
  timeContainer.style.display = 'flex';
  timeContainer.style.flexDirection = 'column';
  timeContainer.style.gap = '0.5rem';
  timeContainer.style.width = '100%';
  timeContainer.style.padding = '0.75rem';
  timeContainer.style.border = '1px solid #e2e8f0';
  timeContainer.style.borderRadius = '6px';
  timeContainer.style.backgroundColor = '#f9fafb';

  const timeLabel = document.createElement('label');
  timeLabel.textContent = 'Hora';
  timeLabel.style.fontSize = '.75rem';
  timeLabel.style.fontWeight = '600';
  timeLabel.style.color = '#374151';
  timeLabel.style.marginBottom = '0.3rem';

  const ampmNav = document.createElement('div');
  ampmNav.style.display = 'flex';
  ampmNav.style.alignItems = 'center';
  ampmNav.style.justifyContent = 'center';
  ampmNav.style.gap = '1rem';
  ampmNav.style.marginBottom = '0.5rem';

  const ampmPrevBtn = document.createElement('button');
  ampmPrevBtn.textContent = '‹';
  ampmPrevBtn.style.background = 'none';
  ampmPrevBtn.style.border = 'none';
  ampmPrevBtn.style.color = '#475569';
  ampmPrevBtn.style.borderRadius = '6px';
  ampmPrevBtn.style.padding = '0.25rem 0.5rem';
  ampmPrevBtn.style.cursor = 'pointer';
  ampmPrevBtn.style.fontSize = '.8rem';
  ampmPrevBtn.type = 'button';

  const ampmSpan = document.createElement('span');
  ampmSpan.style.fontSize = '.85rem';
  ampmSpan.style.fontWeight = '600';
  ampmSpan.style.color = '#0f172a';
  ampmSpan.style.minWidth = '40px';
  ampmSpan.style.textAlign = 'center';

  const ampmNextBtn = document.createElement('button');
  ampmNextBtn.textContent = '›';
  ampmNextBtn.style.background = 'none';
  ampmNextBtn.style.border = 'none';
  ampmNextBtn.style.color = '#475569';
  ampmNextBtn.style.borderRadius = '6px';
  ampmNextBtn.style.padding = '0.25rem 0.5rem';
  ampmNextBtn.style.cursor = 'pointer';
  ampmNextBtn.style.fontSize = '.8rem';
  ampmNextBtn.type = 'button';

  const timeGrid = document.createElement('div');
  timeGrid.style.display = 'grid';
  timeGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
  timeGrid.style.gap = '0.5rem';

  let isPM = selectedHour >= 12;

  const renderTimeGrid = () => {
    ampmSpan.textContent = isPM ? 'PM' : 'AM';
    timeGrid.innerHTML = '';
    const startHour = isPM ? 12 : 0;
    const endHour = isPM ? 24 : 12;
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    const occupiedTimes = getOccupiedHours(dateStr);

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 30) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const displayH = (h % 12 === 0 ? 12 : h % 12).toString().padStart(2, '0');
        const displayM = m.toString().padStart(2, '0');
        btn.textContent = `${displayH}:${displayM}`;
        btn.style.padding = '0.5rem';
        btn.style.border = '1px solid #e2e8f0';
        btn.style.borderRadius = '6px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '0.8rem';
        btn.style.background = 'white';
        btn.style.color = '#475569';
        btn.style.fontFamily = 'inherit';

        const isOccupied = occupiedTimes.some(t => t.h === h && t.m === m);

        if (isOccupied) {
          btn.style.background = '#f1f5f9';
          btn.style.color = '#cbd5e1';
          btn.style.cursor = 'not-allowed';
          btn.style.border = '1px solid #e2e8f0';
          btn.disabled = true;
        }

        if (h === selectedHour && m === selectedMinute) {
          btn.style.background = '#0891b2';
          btn.style.color = 'white';
          btn.style.borderColor = '#0891b2';
          btn.style.fontWeight = '600';
          btn.disabled = false;
          btn.style.cursor = 'pointer';
        }

        if (!isOccupied) {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            selectedHour = h;
            selectedMinute = m;
            updateInput();
            renderTimeGrid();
          });
        }

        timeGrid.appendChild(btn);
      }
    }
  };

  ampmPrevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isPM = !isPM;
    renderTimeGrid();
  });

  ampmNextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isPM = !isPM;
    renderTimeGrid();
  });

  ampmNav.appendChild(ampmPrevBtn);
  ampmNav.appendChild(ampmSpan);
  ampmNav.appendChild(ampmNextBtn);

  timeContainer.appendChild(timeLabel);
  timeContainer.appendChild(ampmNav);
  timeContainer.appendChild(timeGrid);

  // Add everything to wrapper
  wrapper.appendChild(calContainer);
  wrapper.appendChild(timeContainer);

  // Insert and hide input
  input.style.display = 'none';
  input.parentNode.insertBefore(wrapper, input);

  // Initial render
  renderCalendar();
  renderTimeGrid();
  updateInput();

  input._calendarDatetimePicker = {
    wrapper,
    renderCalendar,
    renderTimeGrid,
    updateInput,
    updateFromInput: () => {
      const val = input.value;
      if (val) {
        const [datePart, timePart] = val.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        selectedYear = year;
        selectedMonth = month - 1;
        selectedDay = day;
        selectedHour = hour;
        selectedMinute = minute;
        isPM = hour >= 12;
        renderCalendar();
        renderTimeGrid();
      }
    }
  };
}

window.replaceWithCalendarDatetimePicker = replaceWithCalendarDatetimePicker;

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {});
}
