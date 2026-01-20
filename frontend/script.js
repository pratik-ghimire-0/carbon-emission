/**
 * Carbon Emission Control - Nepal
 * Complete JavaScript Implementation
 * Features: Calculator, Dashboard, Charts, localStorage persistence, PDF export
 */

// ============================================
// EMISSION FACTORS (Nepal-Specific)
// ============================================

// Global state
let calculationHistory = [];
let currentUser = null;
let allUsers = [];
let userActions = [];
let userAchievements = [];

// Action types with points and carbon reduction
const actionTypes = {
    tree: { name: 'Plant a Tree', icon: '🌳', points: 50, carbonReduction: 21.77 },
    transport: { name: 'Use Public Transport', icon: '🚌', points: 20, carbonReduction: 2.5 },
    energy: { name: 'Save Energy', icon: '💡', points: 15, carbonReduction: 1.2 },
    recycle: { name: 'Recycle Waste', icon: '♻️', points: 10, carbonReduction: 0.5 },
    carpool: { name: 'Carpool', icon: '🚗', points: 25, carbonReduction: 3.2 },
    compost: { name: 'Compost Organic Waste', icon: '🌱', points: 15, carbonReduction: 0.8 }
};

// Achievement definitions
const achievements = [
    { id: 'first_action', name: 'First Step', desc: 'Log your first action', icon: '✨', requirement: { type: 'actionCount', value: 1 } },
    { id: 'tree_planter', name: 'Tree Planter', desc: 'Plant 10 trees', icon: '🌳', requirement: { type: 'treeCount', value: 10 } },
    { id: 'point_master', name: 'Point Master', desc: 'Earn 500 points', icon: '🏆', requirement: { type: 'points', value: 500 } },
    { id: 'eco_warrior', name: 'Eco Warrior', desc: 'Save 100kg CO₂', icon: '🛡️', requirement: { type: 'carbonSaved', value: 100 } },
    { id: 'consistent', name: 'Consistent', desc: 'Log actions for 7 days', icon: '📅', requirement: { type: 'daysActive', value: 7 } },
    { id: 'green_champion', name: 'Green Champion', desc: 'Reach level 10', icon: '👑', requirement: { type: 'level', value: 10 } }
];

const EMISSION_FACTORS = {
    // Transport (kg CO₂ per km)
    motorbike: 0.10,    // ~45 km/L fuel efficiency
    car: 0.20,          // ~12 km/L fuel efficiency
    bus: 0.05,          // Per person, high occupancy
    ev: 0.006,          // Nepal's hydropower grid (very low)
    
    // Energy (kg CO₂ per unit)
    electricity: 0.02,  // kWh - Nepal's 92% hydropower
    lpg: 42.3,          // Per 14.2 kg cylinder
    firewood: 1.8,      // Per kg (includes methane)
    biogas: -0.5,       // Negative = carbon credit
    
    // Waste (kg CO₂ per month)
    waste: {
        mixed: 25,
        'some-recycling': 15,
        composting: 8,
        'full-recycling': 5
    }
};

// Nepal average carbon footprint
const NEPAL_AVERAGE_MONTHLY = 42.5; // kg CO₂e per month (0.51 tons/year ÷ 12)
const TREE_ABSORPTION_ANNUAL = 22; // kg CO₂ per tree per year

// ============================================
// DOM ELEMENTS
// ============================================
const carbonForm = document.getElementById('carbonForm');
const resultsSection = document.getElementById('results');
const navLinks = document.querySelectorAll('.nav-link');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

// Results elements
const totalEmissionsEl = document.getElementById('totalEmissions');
const annualEmissionsEl = document.getElementById('annualEmissions');
const comparisonEl = document.getElementById('comparison');
const comparisonTextEl = document.getElementById('comparisonText');
const treesNeededEl = document.getElementById('treesNeeded');
const scoreBadgeEl = document.getElementById('scoreBadge');
const scoreMessageEl = document.getElementById('scoreMessage');
const suggestionsListEl = document.getElementById('suggestionsList');

// Dashboard elements
const dashboardEmpty = document.getElementById('dashboardEmpty');
const dashboardContent = document.getElementById('dashboardContent');
const totalRecordsEl = document.getElementById('totalRecords');
const latestEmissionEl = document.getElementById('latestEmission');
const avgEmissionEl = document.getElementById('avgEmission');
const trendIndicatorEl = document.getElementById('trendIndicator');
const historyTableEl = document.getElementById('historyTable');

// Pledge elements
const pledgeForm = document.getElementById('pledgeForm');
const pledgeSuccess = document.getElementById('pledgeSuccess');
const pledgeCountEl = document.getElementById('pledgeCount');

// Chart instances
let emissionChart = null;
let progressChart = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initializeUser();
    setupQuickActions();
    setupAvatarSelector();
    setupLeaderboard();
    displayActionHistory();
    loadDashboard();
    loadPledgeCount();
});

function initializeApp() {
    // Navigation
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            navMenu.classList.remove('active');
        });
    });
    
    // Form submission
    carbonForm.addEventListener('submit', handleCalculation);
    
    // Save results button
    document.getElementById('saveResults').addEventListener('click', saveToHistory);
    
    // Download report button
    document.getElementById('downloadReport').addEventListener('click', downloadPDF);
    
    // New calculation button
    document.getElementById('newCalculation').addEventListener('click', () => {
        carbonForm.scrollIntoView({ behavior: 'smooth' });
        carbonForm.reset();
        resultsSection.style.display = 'none';
    });
    
    // Clear history button
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
    
    // Pledge form
    pledgeForm.addEventListener('submit', handlePledge);
    
    // Download certificate button
    document.getElementById('downloadCertificate').addEventListener('click', downloadCertificate);
    
    // Modal event listeners
    document.getElementById('actionForm').addEventListener('submit', submitAction);
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    document.querySelector('#actionModal .modal-close').addEventListener('click', closeActionModal);
    document.querySelector('#profileModal .modal-close').addEventListener('click', closeProfileModal);
    document.getElementById('editProfileBtn').addEventListener('click', openProfileModal);
    
    // Close modals when clicking outside
    document.getElementById('actionModal').addEventListener('click', function(e) {
        if (e.target === this) closeActionModal();
    });
    document.getElementById('profileModal').addEventListener('click', function(e) {
        if (e.target === this) closeProfileModal();
    });
}

// ============================================
// CALCULATION LOGIC
// ============================================
function handleCalculation(e) {
    e.preventDefault();
    
    // Get form values
    const formData = {
        locationType: document.getElementById('locationType').value,
        motorbikeKm: parseFloat(document.getElementById('motorbikeKm').value) || 0,
        carKm: parseFloat(document.getElementById('carKm').value) || 0,
        busKm: parseFloat(document.getElementById('busKm').value) || 0,
        evKm: parseFloat(document.getElementById('evKm').value) || 0,
        electricity: parseFloat(document.getElementById('electricity').value) || 0,
        lpgCylinders: parseFloat(document.getElementById('lpgCylinders').value) || 0,
        firewood: parseFloat(document.getElementById('firewood').value) || 0,
        biogas: document.getElementById('biogas').checked,
        wasteManagement: document.getElementById('wasteManagement').value
    };
    
    // Calculate emissions
    const results = calculateEmissions(formData);
    
    // Display results
    displayResults(results, formData);
    
    // Scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function calculateEmissions(data) {
    // Transport emissions (daily * 30 days)
    const transportDaily = 
        (data.motorbikeKm * EMISSION_FACTORS.motorbike) +
        (data.carKm * EMISSION_FACTORS.car) +
        (data.busKm * EMISSION_FACTORS.bus) +
        (data.evKm * EMISSION_FACTORS.ev);
    
    const transportMonthly = transportDaily * 30;
    
    // Energy emissions (monthly)
    const electricityEmissions = data.electricity * EMISSION_FACTORS.electricity;
    const lpgEmissions = data.lpgCylinders * EMISSION_FACTORS.lpg;
    const firewoodEmissions = data.firewood * EMISSION_FACTORS.firewood;
    const biogasCredit = data.biogas ? EMISSION_FACTORS.biogas * 30 : 0;
    
    const energyMonthly = electricityEmissions + lpgEmissions + firewoodEmissions + biogasCredit;
    
    // Waste emissions (monthly)
    const wasteMonthly = EMISSION_FACTORS.waste[data.wasteManagement];
    
    // Total monthly emissions
    const totalMonthly = transportMonthly + energyMonthly + wasteMonthly;
    const totalAnnual = totalMonthly * 12 / 1000; // Convert to tons
    
    // Comparison with Nepal average
    const comparisonPercent = ((totalMonthly - NEPAL_AVERAGE_MONTHLY) / NEPAL_AVERAGE_MONTHLY) * 100;
    
    // Trees needed for offset
    const treesNeeded = Math.ceil(totalAnnual * 1000 / TREE_ABSORPTION_ANNUAL);
    
    // Eco score
    const ecoScore = calculateEcoScore(totalMonthly);
    
    return {
        totalMonthly,
        totalAnnual,
        comparisonPercent,
        treesNeeded,
        ecoScore,
        breakdown: {
            transport: transportMonthly,
            energy: energyMonthly,
            waste: wasteMonthly
        }
    };
}

function calculateEcoScore(emissions) {
    if (emissions < 30) {
        return { level: 'good', text: 'Excellent! Low Carbon Footprint', badge: '🌟 Excellent' };
    } else if (emissions < 50) {
        return { level: 'average', text: 'Average - Room for Improvement', badge: '👍 Good' };
    } else {
        return { level: 'high', text: 'High Emissions - Action Needed', badge: '⚠️ Needs Improvement' };
    }
}

// ============================================
// DISPLAY RESULTS
// ============================================
function displayResults(results, formData) {
    // Show results section
    resultsSection.style.display = 'block';
    
    // Update values
    totalEmissionsEl.textContent = results.totalMonthly.toFixed(2);
    annualEmissionsEl.textContent = results.totalAnnual.toFixed(2);
    treesNeededEl.textContent = results.treesNeeded;
    
    // Comparison
    const comparisonSign = results.comparisonPercent > 0 ? '+' : '';
    comparisonEl.textContent = comparisonSign + results.comparisonPercent.toFixed(1) + '%';
    if (results.comparisonPercent > 0) {
        comparisonTextEl.textContent = 'above Nepal average';
        comparisonTextEl.style.color = '#DC2626';
    } else {
        comparisonTextEl.textContent = 'below Nepal average';
        comparisonTextEl.style.color = '#059669';
    }
    
    // Eco score
    scoreBadgeEl.textContent = results.ecoScore.badge;
    scoreBadgeEl.className = 'score-badge ' + results.ecoScore.level;
    scoreMessageEl.textContent = results.ecoScore.text;
    
    // Create breakdown chart
    createBreakdownChart(results.breakdown);
    
    // Generate suggestions
    generateSuggestions(formData, results);
}

function createBreakdownChart(breakdown) {
    const ctx = document.getElementById('emissionChart');
    
    // Destroy existing chart
    if (emissionChart) {
        emissionChart.destroy();
    }
    
    emissionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Transport', 'Energy', 'Waste'],
            datasets: [{
                data: [
                    breakdown.transport.toFixed(2),
                    breakdown.energy.toFixed(2),
                    breakdown.waste.toFixed(2)
                ],
                backgroundColor: [
                    '#F59E0B',
                    '#0284C7',
                    '#059669'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + ' kg CO₂e';
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// SUGGESTIONS ENGINE
// ============================================
function generateSuggestions(data, results) {
    const suggestions = [];
    
    // Transport suggestions
    if (data.motorbikeKm > 5 || data.carKm > 5) {
        suggestions.push({
            title: '🚌 Switch to Public Transportation',
            description: 'Using buses or microbuses can reduce your transport emissions by up to 75%. Sajha Bus and local public transport are affordable alternatives.',
            impact: 'Save up to ' + (data.motorbikeKm * 30 * EMISSION_FACTORS.motorbike * 0.75).toFixed(1) + ' kg CO₂/month'
        });
    }
    
    if (data.carKm > 3 && data.evKm === 0) {
        suggestions.push({
            title: '⚡ Consider Electric Vehicles',
            description: 'Electric vehicles in Nepal are truly green thanks to our hydropower. EVs have 97% lower emissions than petrol vehicles here!',
            impact: 'Reduce emissions by ' + (data.carKm * 30 * (EMISSION_FACTORS.car - EMISSION_FACTORS.ev)).toFixed(1) + ' kg CO₂/month'
        });
    }
    
    // Energy suggestions
    if (data.electricity > 150) {
        suggestions.push({
            title: '💡 Improve Energy Efficiency',
            description: 'Switch to LED bulbs, use energy-efficient appliances, and unplug devices when not in use. These simple steps can cut electricity use by 20-30%.',
            impact: 'Save ~' + (data.electricity * 0.25 * EMISSION_FACTORS.electricity).toFixed(1) + ' kg CO₂/month'
        });
    }
    
    if (data.lpgCylinders >= 1) {
        suggestions.push({
            title: '🔥 Optimize Cooking Practices',
            description: 'Use pressure cookers, keep lids on pots, and maintain your stove properly. Consider induction cooktops with Nepal\'s clean electricity.',
            impact: 'Reduce LPG use by 15-20%'
        });
    }
    
    if (data.firewood > 50) {
        suggestions.push({
            title: '🌿 Switch to Biogas or Improved Cookstoves',
            description: 'Biogas systems or improved cookstoves dramatically reduce emissions and indoor air pollution. Many government subsidies are available.',
            impact: 'Cut emissions by 60-80%'
        });
    }
    
    // Waste suggestions
    if (data.wasteManagement === 'mixed') {
        suggestions.push({
            title: '♻️ Start Waste Segregation',
            description: 'Separate biodegradable, recyclable, and non-recyclable waste. Compost kitchen waste at home - it\'s easy and reduces methane emissions.',
            impact: 'Save ~' + (EMISSION_FACTORS.waste.mixed - EMISSION_FACTORS.waste.composting).toFixed(1) + ' kg CO₂/month'
        });
    }
    
    // Tree planting suggestion
    suggestions.push({
        title: '🌳 Plant Trees & Support Reforestation',
        description: 'Plant ' + results.treesNeeded + ' trees to fully offset your annual emissions. Join local community forestry programs or organize plantation drives.',
        impact: 'Offset ' + results.totalAnnual.toFixed(2) + ' tons CO₂/year'
    });
    
    // Display suggestions
    suggestionsListEl.innerHTML = suggestions.map(s => `
        <div class="suggestion-item">
            <h4>${s.title}</h4>
            <p>${s.description}</p>
            <span class="suggestion-impact">💚 Impact: ${s.impact}</span>
        </div>
    `).join('');
}

// ============================================
// LOCALSTORAGE MANAGEMENT
// ============================================
function saveToHistory() {
    const currentData = {
        date: new Date().toISOString(),
        totalMonthly: parseFloat(totalEmissionsEl.textContent),
        totalAnnual: parseFloat(annualEmissionsEl.textContent),
        treesNeeded: parseInt(treesNeededEl.textContent),
        ecoScore: scoreBadgeEl.textContent
    };
    
    // Get existing history
    let history = JSON.parse(localStorage.getItem('carbonHistory') || '[]');
    
    // Add new record
    history.unshift(currentData);
    
    // Keep only last 12 records
    if (history.length > 12) {
        history = history.slice(0, 12);
    }
    
    // Save to localStorage
    localStorage.setItem('carbonHistory', JSON.stringify(history));
    
    // Show confirmation
    alert('✅ Results saved to dashboard!');
    
    // Reload dashboard
    loadDashboard();
}

function loadDashboard() {
    const history = JSON.parse(localStorage.getItem('carbonHistory') || '[]');
    
    if (history.length === 0) {
        dashboardEmpty.style.display = 'block';
        dashboardContent.style.display = 'none';
        return;
    }
    
    dashboardEmpty.style.display = 'none';
    dashboardContent.style.display = 'block';
    
    // Calculate stats
    const totalRecords = history.length;
    const latestEmission = history[0].totalMonthly;
    const avgEmission = (history.reduce((sum, record) => sum + record.totalMonthly, 0) / totalRecords).toFixed(2);
    
    // Calculate trend
    let trend = '-';
    if (history.length >= 2) {
        const recent = history[0].totalMonthly;
        const previous = history[1].totalMonthly;
        if (recent < previous) {
            trend = '📉 Decreasing';
        } else if (recent > previous) {
            trend = '📈 Increasing';
        } else {
            trend = '➡️ Stable';
        }
    }
    
    // Update stats
    totalRecordsEl.textContent = totalRecords;
    latestEmissionEl.textContent = latestEmission.toFixed(2);
    avgEmissionEl.textContent = avgEmission;
    trendIndicatorEl.textContent = trend;
    
    // Create progress chart
    createProgressChart(history);
    
    // Create history table
    createHistoryTable(history);
}

function createProgressChart(history) {
    const ctx = document.getElementById('progressChart');
    
    // Destroy existing chart
    if (progressChart) {
        progressChart.destroy();
    }
    
    // Reverse for chronological order
    const reversedHistory = [...history].reverse();
    
    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: reversedHistory.map((record, index) => {
                const date = new Date(record.date);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                label: 'Monthly Emissions (kg CO₂e)',
                data: reversedHistory.map(record => record.totalMonthly),
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'kg CO₂e'
                    }
                }
            }
        }
    });
}

function createHistoryTable(history) {
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Monthly Emissions</th>
                    <th>Annual Estimate</th>
                    <th>Trees Needed</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody>
                ${history.map(record => {
                    const date = new Date(record.date);
                    return `
                        <tr>
                            <td>${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td>${record.totalMonthly.toFixed(2)} kg</td>
                            <td>${record.totalAnnual.toFixed(2)} tons</td>
                            <td>${record.treesNeeded} trees</td>
                            <td>${record.ecoScore}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    historyTableEl.innerHTML = tableHTML;
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
        localStorage.removeItem('carbonHistory');
        loadDashboard();
        alert('✅ History cleared successfully!');
    }
}

// ============================================
// PLEDGE FUNCTIONALITY
// ============================================
function loadPledgeCount() {
    const count = parseInt(localStorage.getItem('pledgeCount') || '127'); // Start with seed number
    pledgeCountEl.textContent = count;
}

function handlePledge(e) {
    e.preventDefault();
    
    const name = document.getElementById('pledgeName').value;
    const district = document.getElementById('pledgeDistrict').value;
    
    // Save pledge
    const pledge = {
        name,
        district,
        date: new Date().toISOString()
    };
    
    localStorage.setItem('userPledge', JSON.stringify(pledge));
    
    // Increment counter
    let count = parseInt(localStorage.getItem('pledgeCount') || '127');
    count++;
    localStorage.setItem('pledgeCount', count.toString());
    pledgeCountEl.textContent = count;
    
    // Show success
    document.getElementById('certificateName').textContent = name;
    document.getElementById('certificateDistrict').textContent = district;
    document.getElementById('certificateDate').textContent = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    document.getElementById('pledgeMessage').textContent = 
        `${name}, your commitment makes a difference! Every action counts towards a greener Nepal.`;
    
    pledgeForm.style.display = 'none';
    pledgeSuccess.style.display = 'block';
}

// ============================================
// PDF EXPORT FUNCTIONALITY
// ============================================
function downloadPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Title
        doc.setFontSize(20);
        doc.setTextColor(5, 150, 105);
        doc.text('Carbon Emission Report', 20, 20);
        
        // Date
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text('Generated on: ' + new Date().toLocaleDateString(), 20, 28);
        
        // Emissions Data
        doc.setFontSize(12);
        doc.setTextColor(31, 41, 55);
        doc.text('Your Carbon Footprint Summary', 20, 40);
        
        doc.setFontSize(10);
        doc.text(`Monthly Emissions: ${totalEmissionsEl.textContent} kg CO₂e`, 20, 50);
        doc.text(`Annual Estimate: ${annualEmissionsEl.textContent} tons CO₂e`, 20, 58);
        doc.text(`Trees Needed for Offset: ${treesNeededEl.textContent} trees`, 20, 66);
        doc.text(`Eco Score: ${scoreBadgeEl.textContent}`, 20, 74);
        
        // Comparison
        doc.text('Comparison with Nepal Average', 20, 86);
        doc.text(`Your emissions are ${comparisonEl.textContent} ${comparisonTextEl.textContent}`, 20, 94);
        
        // Suggestions
        doc.setFontSize(12);
        doc.text('Reduction Suggestions', 20, 106);
        
        const suggestions = document.querySelectorAll('.suggestion-item');
        let yPos = 116;
        suggestions.forEach((suggestion, index) => {
            if (yPos > 270) return; // Avoid overflow
            
            const title = suggestion.querySelector('h4').textContent;
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`${index + 1}. ${title}`, 20, yPos);
            yPos += 8;
            
            const desc = suggestion.querySelector('p').textContent;
            doc.setFont(undefined, 'normal');
            const splitDesc = doc.splitTextToSize(desc, 170);
            doc.text(splitDesc, 25, yPos);
            yPos += splitDesc.length * 5 + 5;
        });
        
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text('Carbon Emission Control - Nepal | For a Sustainable Future', 105, 285, { align: 'center' });
        
        // Save
        doc.save('carbon-footprint-report.pdf');
        
        alert('✅ Report downloaded successfully!');
    } catch (error) {
        console.error('PDF generation error:', error);
        alert('⚠️ Could not generate PDF. Please try again.');
    }
}

function downloadCertificate() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape'
        });
        
        // Border
        doc.setLineWidth(1);
        doc.setDrawColor(5, 150, 105);
        doc.rect(10, 10, 277, 190);
        
        // Title
        doc.setFontSize(28);
        doc.setTextColor(5, 150, 105);
        doc.text('Green Nepal Pledge', 148.5, 40, { align: 'center' });
        doc.text('Certificate of Commitment', 148.5, 55, { align: 'center' });
        
        // Content
        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text('This certifies that', 148.5, 80, { align: 'center' });
        
        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.text(document.getElementById('certificateName').textContent, 148.5, 95, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        doc.text(`from ${document.getElementById('certificateDistrict').textContent}`, 148.5, 110, { align: 'center' });
        
        doc.text('has pledged to reduce their carbon footprint', 148.5, 125, { align: 'center' });
        doc.text('and contribute to a sustainable Nepal', 148.5, 135, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(`Date: ${document.getElementById('certificateDate').textContent}`, 148.5, 155, { align: 'center' });
        
        // Emoji/Icon
        doc.setFontSize(30);
        doc.text('🌳', 148.5, 180, { align: 'center' });
        
        doc.save('green-nepal-pledge-certificate.pdf');
        alert('✅ Certificate downloaded successfully!');
    } catch (error) {
        console.error('Certificate generation error:', error);
        alert('⚠️ Could not generate certificate. Please try again.');
    }
}

// ============================================
// USER PROFILE AND GAMIFICATION
// ============================================

// Initialize user profile
function initializeUser() {
    currentUser = JSON.parse(localStorage.getItem('currentUser')) || {
        name: 'Guest User',
        avatar: '👤',
        district: 'Kathmandu',
        level: 1,
        points: 0,
        treesPlanted: 0,
        carbonSaved: 0,
        actionsCount: 0,
        joinDate: new Date().toISOString()
    };
    
    userActions = JSON.parse(localStorage.getItem('userActions')) || [];
    userAchievements = JSON.parse(localStorage.getItem('userAchievements')) || [];
    allUsers = JSON.parse(localStorage.getItem('allUsers')) || [];
    
    // Ensure current user is in allUsers array
    const userIndex = allUsers.findIndex(u => u.name === currentUser.name && u.district === currentUser.district);
    if (userIndex === -1) {
        allUsers.push(currentUser);
    } else {
        allUsers[userIndex] = currentUser;
    }
    
    saveUserData();
    updateUserProfile();
}

// Save user data to localStorage
function saveUserData() {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('userActions', JSON.stringify(userActions));
    localStorage.setItem('userAchievements', JSON.stringify(userAchievements));
    localStorage.setItem('allUsers', JSON.stringify(allUsers));
}

// Update user profile display
function updateUserProfile() {
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileDistrict').textContent = currentUser.district;
    document.getElementById('profileAvatar').textContent = currentUser.avatar;
    document.getElementById('profileLevel').textContent = currentUser.level;
    document.getElementById('profilePoints').textContent = currentUser.points.toLocaleString();
    document.getElementById('profileTrees').textContent = currentUser.treesPlanted;
    document.getElementById('profileCarbon').textContent = currentUser.carbonSaved.toFixed(1);
    document.getElementById('profileActions').textContent = currentUser.actionsCount;
    
    // Update level progress
    const nextLevelPoints = currentUser.level * 100;
    const currentLevelProgress = (currentUser.points % 100);
    
    updateAchievements();
}

// Calculate level from points
function calculateLevel(points) {
    return Math.floor(points / 100) + 1;
}

// Log a new action
function logAction(actionType, quantity = 1, details = '') {
    const action = actionTypes[actionType];
    if (!action) return;
    
    const pointsEarned = action.points * quantity;
    const carbonReduced = action.carbonReduction * quantity;
    
    // Update user stats
    currentUser.points += pointsEarned;
    currentUser.carbonSaved += carbonReduced;
    currentUser.actionsCount += 1;
    currentUser.level = calculateLevel(currentUser.points);
    
    if (actionType === 'tree') {
        currentUser.treesPlanted += quantity;
    }
    
    // Add to actions history
    const newAction = {
        id: Date.now(),
        type: actionType,
        name: action.name,
        icon: action.icon,
        quantity,
        details,
        points: pointsEarned,
        carbonReduction: carbonReduced,
        date: new Date().toISOString()
    };
    
    userActions.unshift(newAction);
    
    // Update achievements
    checkAchievements();
    
    // Update display and save
    updateUserProfile();
    displayActionHistory();
    saveUserData();
    
    // Show success message
    showNotification(`+${pointsEarned} points! ${action.icon} ${action.name}`, 'success');
}

// Check and unlock achievements
function checkAchievements() {
    achievements.forEach(achievement => {
        // Skip if already unlocked
        if (userAchievements.includes(achievement.id)) return;
        
        let unlocked = false;
        
        switch(achievement.requirement.type) {
            case 'actionCount':
                unlocked = currentUser.actionsCount >= achievement.requirement.value;
                break;
            case 'treeCount':
                unlocked = currentUser.treesPlanted >= achievement.requirement.value;
                break;
            case 'points':
                unlocked = currentUser.points >= achievement.requirement.value;
                break;
            case 'carbonSaved':
                unlocked = currentUser.carbonSaved >= achievement.requirement.value;
                break;
            case 'level':
                unlocked = currentUser.level >= achievement.requirement.value;
                break;
            case 'daysActive':
                const uniqueDays = new Set(userActions.map(a => new Date(a.date).toDateString()));
                unlocked = uniqueDays.size >= achievement.requirement.value;
                break;
        }
        
        if (unlocked) {
            userAchievements.push(achievement.id);
            showNotification(`🎉 Achievement Unlocked: ${achievement.name}!`, 'achievement');
        }
    });
}

// Update achievements display
function updateAchievements() {
    const achievementsGrid = document.getElementById('achievementsGrid');
    achievementsGrid.innerHTML = '';
    
    achievements.forEach(achievement => {
        const isUnlocked = userAchievements.includes(achievement.id);
        const badgeEl = document.createElement('div');
        badgeEl.className = `achievement-badge ${isUnlocked ? 'unlocked' : 'locked'}`;
        badgeEl.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-name">${achievement.name}</div>
            <div class="achievement-desc">${achievement.desc}</div>
        `;
        achievementsGrid.appendChild(badgeEl);
    });
}

// Display action history
function displayActionHistory() {
    const historyList = document.getElementById('actionHistoryList');
    
    if (userActions.length === 0) {
        historyList.innerHTML = '<div class="empty-message">No actions logged yet. Start making a difference!</div>';
        return;
    }
    
    historyList.innerHTML = '';
    
    userActions.slice(0, 10).forEach(action => {
        const actionEl = document.createElement('div');
        actionEl.className = 'action-history-item';
        
        const date = new Date(action.date);
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        actionEl.innerHTML = `
            <div class="action-info">
                <h4>${action.icon} ${action.name} ${action.quantity > 1 ? `(${action.quantity}x)` : ''}</h4>
                <p>${action.details || 'Making a positive impact!'}</p>
            </div>
            <div class="action-reward">
                <div class="points">+${action.points}</div>
                <div class="date">${formattedDate}</div>
            </div>
        `;
        
        historyList.appendChild(actionEl);
    });
}

// Quick action buttons
function setupQuickActions() {
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const actionType = this.dataset.action;
            openActionModal(actionType);
        });
    });
}

// ============================================
// MODAL HANDLERS
// ============================================

function openActionModal(actionType = 'tree') {
    const modal = document.getElementById('actionModal');
    const actionSelect = document.getElementById('actionType');
    actionSelect.value = actionType;
    
    modal.classList.add('show');
}

function closeActionModal() {
    const modal = document.getElementById('actionModal');
    modal.classList.remove('show');
}

function submitAction(event) {
    event.preventDefault();
    
    const actionType = document.getElementById('actionType').value;
    const quantity = parseInt(document.getElementById('actionQuantity').value) || 1;
    const details = document.getElementById('actionDetails').value;
    
    logAction(actionType, quantity, details);
    
    // Reset form and close modal
    event.target.reset();
    closeActionModal();
}

function openProfileModal() {
    const modal = document.getElementById('profileModal');
    
    // Pre-fill current values
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editDistrict').value = currentUser.district;
    
    // Set selected avatar
    document.querySelectorAll('.avatar-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.avatar === currentUser.avatar);
    });
    
    modal.classList.add('show');
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.classList.remove('show');
}

function saveProfile(event) {
    event.preventDefault();
    
    const newName = document.getElementById('editName').value.trim();
    const newDistrict = document.getElementById('editDistrict').value;
    const selectedAvatar = document.querySelector('.avatar-option.selected');
    
    if (!newName) {
        alert('Please enter a valid name');
        return;
    }
    
    currentUser.name = newName;
    currentUser.district = newDistrict;
    if (selectedAvatar) {
        currentUser.avatar = selectedAvatar.dataset.avatar;
    }
    
    saveUserData();
    updateUserProfile();
    closeProfileModal();
    
    showNotification('Profile updated successfully!', 'success');
}

// Avatar selection
function setupAvatarSelector() {
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
}

// ============================================
// LEADERBOARD
// ============================================

let currentLeaderboardFilter = 'all';

function setupLeaderboard() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentLeaderboardFilter = this.dataset.filter;
            updateLeaderboard();
        });
    });
    
    // Seed some demo users if needed
    if (allUsers.length < 10) {
        seedDemoUsers();
    }
    
    updateLeaderboard();
}

function seedDemoUsers() {
    const demoUsers = [
        { name: 'Sita Sharma', avatar: '👩', district: 'Kathmandu', points: 850, treesPlanted: 15, carbonSaved: 142.3, actionsCount: 42, level: 9 },
        { name: 'Ram Thapa', avatar: '👨', district: 'Pokhara', points: 720, treesPlanted: 12, carbonSaved: 98.5, actionsCount: 35, level: 8 },
        { name: 'Maya Gurung', avatar: '👧', district: 'Chitwan', points: 680, treesPlanted: 10, carbonSaved: 87.2, actionsCount: 31, level: 7 },
        { name: 'Krishna Magar', avatar: '🧑', district: 'Lalitpur', points: 550, treesPlanted: 9, carbonSaved: 72.1, actionsCount: 28, level: 6 },
        { name: 'Binita Rai', avatar: '👩', district: 'Bhaktapur', points: 480, treesPlanted: 8, carbonSaved: 65.4, actionsCount: 24, level: 5 },
        { name: 'Anil Tamang', avatar: '👨', district: 'Kathmandu', points: 420, treesPlanted: 7, carbonSaved: 58.3, actionsCount: 21, level: 5 },
        { name: 'Sunita Lama', avatar: '👧', district: 'Pokhara', points: 380, treesPlanted: 6, carbonSaved: 51.2, actionsCount: 19, level: 4 },
        { name: 'Prakash Shrestha', avatar: '🧑', district: 'Biratnagar', points: 320, treesPlanted: 5, carbonSaved: 44.7, actionsCount: 16, level: 4 }
    ];
    
    demoUsers.forEach(user => {
        const exists = allUsers.find(u => u.name === user.name && u.district === user.district);
        if (!exists) {
            allUsers.push({ ...user, joinDate: new Date().toISOString() });
        }
    });
    
    saveUserData();
}

function updateLeaderboard() {
    let filteredUsers = [...allUsers];
    
    // Apply time filter
    if (currentLeaderboardFilter !== 'all') {
        const now = new Date();
        const filterDate = new Date();
        
        if (currentLeaderboardFilter === 'month') {
            filterDate.setMonth(now.getMonth() - 1);
        } else if (currentLeaderboardFilter === 'week') {
            filterDate.setDate(now.getDate() - 7);
        }
        
        // For demo purposes, we'll show all users but you could filter by recent actions
        // In a real app, you'd track point earnings by date
    }
    
    // Sort by points
    filteredUsers.sort((a, b) => b.points - a.points);
    
    // Update podium (top 3)
    updatePodium(filteredUsers.slice(0, 3));
    
    // Update table
    updateLeaderboardTable(filteredUsers);
    
    // Update user's rank
    updateUserRank(filteredUsers);
}

function updatePodium(topThree) {
    const places = ['first', 'second', 'third'];
    const medals = ['🥇', '🥈', '🥉'];
    
    places.forEach((place, index) => {
        const user = topThree[index];
        const podiumEl = document.getElementById(`podium${place.charAt(0).toUpperCase() + place.slice(1)}`);
        
        if (user) {
            podiumEl.innerHTML = `
                <div class="podium-medal">${medals[index]}</div>
                <div class="podium-user">${user.avatar} ${user.name}</div>
                <div class="podium-points">${user.points.toLocaleString()} pts</div>
            `;
        } else {
            podiumEl.innerHTML = `
                <div class="podium-medal">${medals[index]}</div>
                <div class="podium-user">-</div>
                <div class="podium-points">0 pts</div>
            `;
        }
    });
}

function updateLeaderboardTable(users) {
    const tbody = document.querySelector('#leaderboardTable tbody');
    tbody.innerHTML = '';
    
    users.forEach((user, index) => {
        const isCurrentUser = user.name === currentUser.name && user.district === currentUser.district;
        const row = document.createElement('tr');
        if (isCurrentUser) {
            row.style.background = 'rgba(5, 150, 105, 0.1)';
            row.style.fontWeight = '700';
        }
        
        row.innerHTML = `
            <td class="rank-cell">#${index + 1}</td>
            <td class="user-cell">
                <div class="user-avatar-small">${user.avatar}</div>
                <div>${user.name}</div>
            </td>
            <td>${user.district}</td>
            <td>${user.points.toLocaleString()}</td>
            <td>${user.treesPlanted}</td>
            <td>${user.carbonSaved.toFixed(1)} kg</td>
            <td>Level ${user.level}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function updateUserRank(users) {
    const userIndex = users.findIndex(u => u.name === currentUser.name && u.district === currentUser.district);
    const rank = userIndex + 1;
    
    document.getElementById('yourRank').innerHTML = `
        <h4>Your Rank: #${rank} out of ${users.length}</h4>
        <p>Keep taking action to climb the leaderboard!</p>
    `;
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#059669' : type === 'achievement' ? '#F59E0B' : '#0284C7'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

console.log('🌍 Carbon Emission Control App Initialized - Nepal Edition');
console.log('💚 Building a greener future, one calculation at a time!');
