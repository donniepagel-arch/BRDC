/**
 * Tutorial System
 * Phase 5 - Polish
 * Interactive walkthrough and strategy lessons
 */

class Tutorial {
    constructor(game) {
        this.game = game;
        this.currentStep = 0;
        this.isActive = false;
        this.currentLesson = null;

        // Tutorial completion tracking
        this.completed = this.loadCompletionState();
    }

    /**
     * Load completion state from localStorage
     */
    loadCompletionState() {
        const saved = localStorage.getItem('virtualDartsTutorial');
        return saved ? JSON.parse(saved) : {
            basics: false,
            practice: false,
            game501: false,
            gameCricket: false,
            strategy501: false,
            strategyCricket: false,
            advanced: false
        };
    }

    /**
     * Save completion state
     */
    saveCompletionState() {
        localStorage.setItem('virtualDartsTutorial', JSON.stringify(this.completed));
    }

    /**
     * Start a tutorial lesson
     */
    startLesson(lessonId) {
        const lesson = LESSONS[lessonId];
        if (!lesson) return;

        this.currentLesson = lessonId;
        this.currentStep = 0;
        this.isActive = true;

        this.showStep(lesson.steps[0]);
    }

    /**
     * Show a tutorial step
     */
    showStep(step) {
        // Create overlay if needed
        let overlay = document.getElementById('tutorialOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'tutorialOverlay';
            overlay.className = 'tutorial-overlay';
            document.body.appendChild(overlay);
        }

        // Generate step content
        overlay.innerHTML = this.generateStepHTML(step);

        // Add event listeners
        this.attachStepListeners(step);

        // Highlight element if specified
        if (step.highlight) {
            this.highlightElement(step.highlight);
        }

        overlay.classList.add('visible');
    }

    /**
     * Generate HTML for a step
     */
    generateStepHTML(step) {
        const lesson = LESSONS[this.currentLesson];
        const totalSteps = lesson.steps.length;

        return `
            <div class="tutorial-popup ${step.position || 'center'}">
                <div class="tutorial-header">
                    <span class="tutorial-title">${lesson.title}</span>
                    <span class="tutorial-progress">${this.currentStep + 1}/${totalSteps}</span>
                </div>

                <div class="tutorial-content">
                    ${step.title ? `<h3>${step.title}</h3>` : ''}
                    <p>${step.content}</p>

                    ${step.image ? `<img src="${step.image}" alt="" class="tutorial-image">` : ''}

                    ${step.tips ? `
                        <div class="tutorial-tips">
                            <strong>Tips:</strong>
                            <ul>
                                ${step.tips.map(tip => `<li>${tip}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>

                <div class="tutorial-footer">
                    ${this.currentStep > 0 ? `
                        <button class="tutorial-btn tutorial-prev" onclick="window.tutorial.prevStep()">
                            Back
                        </button>
                    ` : `
                        <button class="tutorial-btn tutorial-skip" onclick="window.tutorial.skip()">
                            Skip Tutorial
                        </button>
                    `}

                    ${step.action ? `
                        <span class="tutorial-action-hint">${step.actionHint || 'Complete the action to continue'}</span>
                    ` : `
                        <button class="tutorial-btn tutorial-next" onclick="window.tutorial.nextStep()">
                            ${this.currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Attach listeners for step interactions
     */
    attachStepListeners(step) {
        if (step.action) {
            // Wait for specific action to complete
            switch (step.action) {
                case 'swipe':
                    this.waitForSwipe();
                    break;
                case 'tap':
                    this.waitForTap(step.target);
                    break;
                case 'complete_practice':
                    this.waitForPracticeComplete();
                    break;
            }
        }
    }

    /**
     * Wait for a swipe action
     */
    waitForSwipe() {
        const originalCallback = this.game.onSwipe.bind(this.game);
        this.game.onSwipe = (swipeData) => {
            originalCallback(swipeData);
            this.game.onSwipe = originalCallback;
            this.nextStep();
        };
    }

    /**
     * Wait for a tap action
     */
    waitForTap(target) {
        const handler = (e) => {
            const targetEl = document.querySelector(target);
            if (targetEl && (e.target === targetEl || targetEl.contains(e.target))) {
                document.removeEventListener('click', handler);
                this.nextStep();
            }
        };
        document.addEventListener('click', handler);
    }

    /**
     * Wait for practice mode to complete
     */
    waitForPracticeComplete() {
        const checkComplete = setInterval(() => {
            if (this.game.state.mode !== 'practice') {
                clearInterval(checkComplete);
                this.nextStep();
            }
        }, 500);
    }

    /**
     * Highlight an element
     */
    highlightElement(selector) {
        // Remove existing highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });

        // Add highlight to target
        const element = document.querySelector(selector);
        if (element) {
            element.classList.add('tutorial-highlight');
        }
    }

    /**
     * Move to next step
     */
    nextStep() {
        const lesson = LESSONS[this.currentLesson];

        this.currentStep++;

        if (this.currentStep >= lesson.steps.length) {
            this.completeLesson();
        } else {
            this.showStep(lesson.steps[this.currentStep]);
        }
    }

    /**
     * Move to previous step
     */
    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            const lesson = LESSONS[this.currentLesson];
            this.showStep(lesson.steps[this.currentStep]);
        }
    }

    /**
     * Skip tutorial
     */
    skip() {
        this.isActive = false;
        this.removeOverlay();
    }

    /**
     * Complete current lesson
     */
    completeLesson() {
        this.completed[this.currentLesson] = true;
        this.saveCompletionState();

        this.isActive = false;
        this.removeOverlay();

        // Show completion message
        this.showCompletionMessage();
    }

    /**
     * Remove overlay
     */
    removeOverlay() {
        const overlay = document.getElementById('tutorialOverlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }

        // Remove highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
    }

    /**
     * Show completion message
     */
    showCompletionMessage() {
        const lesson = LESSONS[this.currentLesson];

        const message = document.createElement('div');
        message.className = 'tutorial-complete-message';
        message.innerHTML = `
            <div class="tutorial-complete-icon">✓</div>
            <div class="tutorial-complete-text">
                <h3>Lesson Complete!</h3>
                <p>${lesson.completionMessage || 'Great job! You\'ve completed this lesson.'}</p>
            </div>
        `;

        document.body.appendChild(message);

        setTimeout(() => {
            message.classList.add('fade-out');
            setTimeout(() => message.remove(), 300);
        }, 3000);
    }

    /**
     * Check if should show first-time tutorial
     */
    shouldShowOnboarding() {
        return !this.completed.basics;
    }

    /**
     * Get available lessons
     */
    getAvailableLessons() {
        return Object.keys(LESSONS).map(id => ({
            id,
            title: LESSONS[id].title,
            description: LESSONS[id].description,
            completed: this.completed[id],
            duration: LESSONS[id].duration
        }));
    }

    /**
     * Generate lessons menu HTML
     */
    generateLessonsMenuHTML() {
        const lessons = this.getAvailableLessons();

        return `
            <div class="lessons-menu">
                <h2>Tutorials & Lessons</h2>
                <div class="lessons-grid">
                    ${lessons.map(lesson => `
                        <div class="lesson-card ${lesson.completed ? 'completed' : ''}"
                             onclick="window.tutorial.startLesson('${lesson.id}')">
                            <div class="lesson-status">
                                ${lesson.completed ? '✓' : ''}
                            </div>
                            <h3>${lesson.title}</h3>
                            <p>${lesson.description}</p>
                            <span class="lesson-duration">${lesson.duration}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

/**
 * Tutorial Lessons Content
 */
const LESSONS = {
    basics: {
        title: 'Getting Started',
        description: 'Learn the basic controls and mechanics',
        duration: '2 min',
        completionMessage: 'You\'ve learned the basics! Try practice mode next.',
        steps: [
            {
                title: 'Welcome to Virtual Darts!',
                content: 'This game teaches real dart strategy through swipe-based throwing. Let\'s learn how it works!',
                position: 'center'
            },
            {
                title: 'The Dartboard',
                content: 'This is a standard dartboard. The numbers around the edge show the base score for each segment. Trebles (inner narrow ring) multiply by 3, doubles (outer narrow ring) multiply by 2.',
                highlight: '#dartboard',
                position: 'right'
            },
            {
                title: 'How to Throw',
                content: 'Swipe UPWARD on the board to throw a dart. The speed, length, and straightness of your swipe all affect where the dart lands.',
                tips: [
                    'Swipe faster for more power',
                    'Short swipes = dart goes HIGH',
                    'Long swipes = dart goes LOW',
                    'Keep swipes straight for accuracy'
                ],
                position: 'center'
            },
            {
                title: 'Try a Throw!',
                content: 'Swipe upward now to throw your first dart!',
                action: 'swipe',
                actionHint: 'Swipe upward to continue',
                position: 'bottom'
            },
            {
                title: 'Great Throw!',
                content: 'You did it! The more you practice, the more consistent your throws will become. Practice mode helps you find your natural throwing style.',
                position: 'center'
            }
        ]
    },

    practice: {
        title: 'Practice Mode',
        description: 'Learn how calibration works',
        duration: '3 min',
        completionMessage: 'Your throw baseline has been established!',
        steps: [
            {
                title: 'Why Practice?',
                content: 'Everyone has a unique throwing style. Practice mode analyzes YOUR swipes to learn how you naturally throw, so the game can give you better results.',
                position: 'center'
            },
            {
                title: 'Throw Naturally',
                content: 'During practice, just throw naturally - don\'t try to aim too carefully. The goal is to establish your baseline.',
                tips: [
                    'Throw at a comfortable speed',
                    'Don\'t overthink it',
                    'The game will learn YOUR style'
                ],
                position: 'center'
            },
            {
                title: 'What Gets Measured',
                content: 'The game tracks your average speed, swipe length, natural drift (do you tend to go left or right?), and consistency.',
                position: 'center'
            },
            {
                title: 'Your Profile',
                content: 'After practice, you\'ll see a report showing your throw profile. This helps the game adjust for YOUR natural tendencies.',
                position: 'center'
            }
        ]
    },

    game501: {
        title: 'Playing 501',
        description: 'Learn the rules of 501',
        duration: '3 min',
        completionMessage: 'You\'re ready to play 501!',
        steps: [
            {
                title: '501 Rules',
                content: 'In 501, you start with 501 points and try to reduce to exactly zero. The twist? You must finish on a DOUBLE.',
                position: 'center'
            },
            {
                title: 'Scoring',
                content: 'Each turn you throw 3 darts. Your total score for those 3 darts is subtracted from your remaining points.',
                tips: [
                    'T20 (60) is the highest single-dart score',
                    '180 (three T20s) is the maximum turn',
                    'Bulls: inner = 50, outer = 25'
                ],
                position: 'center'
            },
            {
                title: 'The Checkout',
                content: 'When you get close to zero, you need to "checkout" - hit a double that takes you to exactly zero. For example, with 40 left, you need D20 (double 20).',
                position: 'center'
            },
            {
                title: 'Busting',
                content: 'If you score more than you have left, or leave yourself on 1, you "bust" and your turn ends with no score. Plan your finishes!',
                position: 'center'
            },
            {
                title: 'Auto-Suggest',
                content: 'The game will suggest what to aim at based on your score. Follow the suggestions to learn optimal strategy!',
                position: 'center'
            }
        ]
    },

    gameCricket: {
        title: 'Playing Cricket',
        description: 'Learn the rules of Cricket',
        duration: '3 min',
        completionMessage: 'You\'re ready to play Cricket!',
        steps: [
            {
                title: 'Cricket Rules',
                content: 'In Cricket, you need to "close" numbers 20 through 15 and the bullseye by hitting each three times.',
                position: 'center'
            },
            {
                title: 'Marks',
                content: 'Each segment you hit counts as marks: single = 1 mark, double = 2 marks, treble = 3 marks. Three marks closes a number.',
                tips: [
                    'T20 = 3 marks (closes 20s in one dart!)',
                    'Double Bull = 2 marks',
                    'Single Bull = 1 mark'
                ],
                position: 'center'
            },
            {
                title: 'Scoring Points',
                content: 'Once YOU have closed a number but your opponent hasn\'t, you can score points on that number. The point value equals the number (20s = 20 points per mark).',
                position: 'center'
            },
            {
                title: 'Winning',
                content: 'To win, close all numbers AND have equal or more points than your opponent. In solo mode, just close all numbers!',
                position: 'center'
            },
            {
                title: 'MPR',
                content: 'Marks Per Round (MPR) is the main Cricket stat. A 3.0 MPR means averaging 3 marks per turn - one number closed per turn!',
                position: 'center'
            }
        ]
    },

    strategy501: {
        title: '501 Strategy',
        description: 'Advanced checkout strategies',
        duration: '5 min',
        completionMessage: 'You\'ve learned key 501 strategies!',
        steps: [
            {
                title: 'The Setup Shot',
                content: 'When above 170, aim to leave yourself a "preferred finish" - a score with multiple checkout paths and good doubles.',
                tips: [
                    '40 (D20) - the most common finish',
                    '32 (D16) - favorite of pros',
                    '36 (D18) - reliable finish'
                ],
                position: 'center'
            },
            {
                title: 'Checkout Charts',
                content: 'Memorize common checkouts! The game suggests the optimal path, but knowing them yourself makes you faster.',
                tips: [
                    '170 = T20, T20, Bull (the "big fish")',
                    '100 = T20, D20',
                    '80 = T20, D10',
                    '61 = T15, D8'
                ],
                position: 'center'
            },
            {
                title: 'Bogey Numbers',
                content: 'Some scores (169, 168, 166, 165, 163, 162, 159) are impossible to checkout with 3 darts. Avoid leaving these!',
                position: 'center'
            },
            {
                title: 'Wedge Shots',
                content: 'On certain scores, aiming between two segments gives you good outcomes either way. For example, on 46: aim between 6 and 10.',
                tips: [
                    '46: 6/10 wedge - all leaves good doubles',
                    '32: Can go for D16 or S16+D8 path'
                ],
                position: 'center'
            }
        ]
    },

    strategyCricket: {
        title: 'Cricket Strategy',
        description: 'Offensive and defensive play',
        duration: '4 min',
        completionMessage: 'You\'ve learned key Cricket strategies!',
        steps: [
            {
                title: 'When to Close vs Score',
                content: 'The key decision in Cricket: close numbers to stop opponent scoring, or score on your open numbers?',
                position: 'center'
            },
            {
                title: 'If You\'re Ahead',
                content: 'When ahead in points, focus on CLOSING the opponent\'s open numbers. Cut off their scoring opportunities!',
                position: 'center'
            },
            {
                title: 'If You\'re Behind',
                content: 'When behind in points, focus on SCORING on your open numbers. You need to catch up before closing out!',
                position: 'center'
            },
            {
                title: 'Number Priority',
                content: 'Close higher numbers first (20s, 19s) - they\'re worth more points. But if opponent has 20s open and you don\'t, close theirs!',
                position: 'center'
            }
        ]
    },

    advanced: {
        title: 'Advanced Techniques',
        description: 'Oche position and deflections',
        duration: '3 min',
        completionMessage: 'You\'ve mastered advanced techniques!',
        steps: [
            {
                title: 'Oche Position',
                content: 'You can move left or right along the throwing line (oche). This changes your angle to the board.',
                position: 'center'
            },
            {
                title: 'Why Move?',
                content: 'Moving position helps avoid darts already on the board. If T20 is crowded, throwing from the right gives a better angle.',
                tips: [
                    'Moving increases distance slightly',
                    'Angle magnifies aiming errors',
                    'Good for avoiding deflections'
                ],
                position: 'center'
            },
            {
                title: 'Deflections',
                content: 'When darts are grouped tightly, incoming darts can deflect off existing ones. Plan your grouping!',
                position: 'center'
            },
            {
                title: 'Board Management',
                content: 'Think ahead - if aiming for T20 three times, the third dart has higher deflection risk. Consider switching targets.',
                position: 'center'
            }
        ]
    }
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Tutorial, LESSONS };
}
