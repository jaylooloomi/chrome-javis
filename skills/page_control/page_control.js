/**
 * Page Control Skill - Navigate previous/next page
 * Executes in page context using window.history API
 */

async function executePageControl(args) {
  const { direction } = args;

  try {
    // Validate direction parameter
    if (!direction || !['previous', 'next'].includes(direction)) {
      console.error('❌ page_control: Invalid direction. Must be "previous" or "next".');
      return {
        success: false,
        error: 'Invalid direction parameter'
      };
    }

    // Execute navigation based on direction
    if (direction === 'previous') {
      window.history.back();
      console.log('✅ page_control: Navigated to previous page');
      return {
        success: true,
        message: 'Navigated to previous page',
        direction: 'previous'
      };
    } else if (direction === 'next') {
      window.history.forward();
      console.log('✅ page_control: Navigated to next page');
      return {
        success: true,
        message: 'Navigated to next page',
        direction: 'next'
      };
    }
  } catch (error) {
    console.error('❌ page_control error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute the skill
executePageControl(args).then(result => {
  console.log('page_control result:', result);
});
