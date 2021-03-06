import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { groupBy } from 'lodash';
import moment from 'moment';
import { Box, useTheme, useMediaQuery, Tabs, Tab, Typography, makeStyles } from '@material-ui/core';
import { useQuery } from 'react-query';
import axios from 'axios';

import { Comment } from './components/Comment';
import { SortBySelector, SortEnum } from './components/SortBySelector';

// TODO: separate component (own file)
//https://material-ui.com/components/tabs/
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box p={3}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.any.isRequired,
  value: PropTypes.any.isRequired,
};

// Tab props
function a11yProps(index) {
  return {
    id: `vertical-tab-${index}`,
    'aria-controls': `vertical-tabpanel-${index}`,
    width: '10%',
  };
}

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    height: '86vh',
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
    minWidth: '15%',
  },
}));

export const CommentsGridPage = () => {
  const classes = useStyles();
  const [value, setValue] = useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  //theme and mediaQuery breakpoints
  const theme = useTheme();
  const xs = useMediaQuery(theme.breakpoints.down('xs'));
  // fetching comments
  const comments = useQuery(
    'comments',
    async () => {
      const response = await axios.request({
        method: 'get',
        url: 'https://www.reddit.com/r/wallstreetbets/comments.json',
        params: {
          sort: 'new',
          limit: 30, // not 100 for now because of bad performance of fetching user details individually
        },
      });

      return response.data?.data?.children?.map((obj) => obj.data);
    },
    {
      keepPreviousData: true, // so the data doesnt disappear
      // refetchInterval: false,
      refetchInterval: 15 * 1000,
    }
  );

  // fetching authors
  const authors = useQuery(
    ['authors', { comments: comments.data }],
    async ({ queryKey: [, { comments }] }) => {
      // TODO
      // better to batch fetch the list but not sure how to do that ATM...
      const authorsDetails = await Promise.all(
        comments.map(async (comment) => {
          const response = await axios.get(`https://www.reddit.com/user/${comment.author}/about/.json`);
          return response.data.data;
        })
      );

      return authorsDetails;
    },
    {
      enabled: !!comments.data,
    }
  );

  // grouping the comments by author criteria
  // for now grouping by hardcoded account ages
  const commentGroups = useMemo(() => {
    if (authors.data && comments.data) {
      const groups = groupBy(comments.data, (comment) => {
        const commentAuthorDetails = authors.data.find((author) => comment.author === author.name);
        const authorAge = moment(commentAuthorDetails.created_utc * 1000);
        if (authorAge.isBefore(moment().subtract(6, 'years'))) {
          return 1;
        } else if (authorAge.isBefore(moment().subtract(3, 'years'))) {
          return 2;
        } else if (authorAge.isBefore(moment().subtract(1, 'years'))) {
          return 3;
        } else {
          return 4;
        }
      });

      return groups;
    }

    return null;
  }, [authors, comments]);

  return (
    <>
      {/* saved in local storage or a cookie */}
      <SortBySelector initialSort={SortEnum.ACCOUNT_AGE} />

      {!!commentGroups &&
        (xs ? (
          <div className={classes.root}>
            <Tabs
              orientation="vertical"
              variant="scrollable"
              value={value}
              onChange={handleChange}
              aria-label="Vertical tabs example"
              className={classes.tabs}
            >
              {[1, 2, 3, 4].map((groupIndex) => {
                return (
                  <Tab label={groupIndex} {...a11yProps(groupIndex)}>
                    {commentGroups[groupIndex]?.map?.((comment) => {
                      const author = authors.data.find((author) => comment.author === author.name);
                      return <Comment key={comment.id} comment={comment} author={author} />;
                    })}
                  </Tab>
                );
              })}
            </Tabs>
            {[1, 2, 3, 4].map((groupIndex) => {
              return (
                <TabPanel style={{ overflow: 'auto' }} value={value} index={groupIndex - 1}>
                  {commentGroups[groupIndex]?.map?.((comment) => {
                    const author = authors.data.find((author) => comment.author === author.name);
                    return <Comment key={comment.id} comment={comment} author={author} />;
                  })}
                </TabPanel>
              );
            })}
          </div>
        ) : (
          <Box style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }} container spacing={3}>
            {[1, 2, 3, 4].map((groupIndex) => {
              return (
                <Box key={groupIndex} style={{ minWidth: '25%', maxHeight: '100vh', overflow: 'auto' }}>
                  {commentGroups[groupIndex]?.map?.((comment) => {
                    const author = authors.data.find((author) => comment.author === author.name);
                    return <Comment key={comment.id} comment={comment} author={author} />;
                  })}
                </Box>
              );
            })}
          </Box>
        ))}
    </>
  );
};

export default CommentsGridPage;
